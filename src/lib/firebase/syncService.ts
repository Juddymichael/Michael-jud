import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from './config';
import {
  getUserTradesRef,
  getUserTradeDocRef,
  getUserSetupsRef,
  getUserSettingsRef,
  getUserDocRef,
} from './firestoreSchema';
import { Trade } from '../../types/trade';
import { Setup } from '../../types/setup';
import { UserSettings } from '../../types/settings';
import { TradeRepository } from '../database/repositories/tradeRepository';
import { setupRepository } from '../database/repositories/setupRepository';
import { SettingsRepository } from '../database/repositories/settingsRepository';

/**
 * Executes a promise with an automatic timeout to prevent endless hanging.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 8000,
  fallbackMsg: string = 'Opération Firestore expirée'
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(fallbackMsg)), ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sanitizes objects for Firestore by converting `undefined` to `null`
 * or removing unsupported field values. Also truncates giant base64
 * strings if they exceed Firestore document limits.
 */
export function sanitizeForFirestore<T>(data: T): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item));
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        clean[key] = null;
      } else if (typeof value === 'string' && value.length > 800000) {
        // Guard against Firestore 1MB document limit
        clean[key] = null;
      } else if (value !== null && typeof value === 'object') {
        clean[key] = sanitizeForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }
  return data;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: Date | null;
  tradeCount: number;
  message?: string;
}

export class CloudSyncService {
  /**
   * Saves or updates a single trade in the user's Firestore collection.
   */
  static async uploadTrade(userId: string, trade: Trade): Promise<void> {
    try {
      const ref = getUserTradeDocRef(userId, trade.id);
      if (!ref) return;
      const sanitized = sanitizeForFirestore(trade);
      await withTimeout(setDoc(ref, sanitized, { merge: true }), 6000);
    } catch (e) {
      console.warn('Sync trade failed (local data remains safe):', e);
    }
  }

  /**
   * Deletes a trade from the user's Firestore collection.
   */
  static async deleteTrade(userId: string, tradeId: string): Promise<void> {
    try {
      const ref = getUserTradeDocRef(userId, tradeId);
      if (!ref) return;
      await withTimeout(deleteDoc(ref), 6000);
    } catch (e) {
      console.warn('Delete remote trade failed:', e);
    }
  }

  /**
   * Saves or updates a trading setup in Firestore.
   */
  static async uploadSetup(userId: string, setup: Setup): Promise<void> {
    try {
      const db = getFirebaseDb();
      if (!db) return;
      const ref = doc(db, 'users', userId, 'setups', setup.id);
      await withTimeout(setDoc(ref, sanitizeForFirestore(setup), { merge: true }), 5000);
    } catch (e) {
      console.warn('Upload setup skipped:', e);
    }
  }

  /**
   * Deletes a trading setup from Firestore.
   */
  static async deleteSetup(userId: string, setupId: string): Promise<void> {
    try {
      const db = getFirebaseDb();
      if (!db) return;
      const ref = doc(db, 'users', userId, 'setups', setupId);
      await withTimeout(deleteDoc(ref), 5000);
    } catch (e) {
      console.warn('Delete setup skipped:', e);
    }
  }

  /**
   * Saves user settings to Firestore.
   */
  static async uploadSettings(userId: string, settings: UserSettings): Promise<void> {
    try {
      const db = getFirebaseDb();
      if (!db) return;
      const ref = doc(db, 'users', userId, 'settings', 'preferences');
      await withTimeout(setDoc(ref, sanitizeForFirestore(settings), { merge: true }), 5000);
    } catch (e) {
      console.warn('Upload settings skipped:', e);
    }
  }

  /**
   * Performs an initial bidirectional reconciliation:
   * - Reads all remote trades from Firestore (with timeout).
   * - Reads all local trades from IndexedDB.
   * - Uploads local trades that don't exist remotely.
   * - Downloads remote trades that don't exist locally into IndexedDB.
   */
  static async fullBidirectionalSync(userId: string): Promise<{
    syncedToCloud: number;
    downloadedToLocal: number;
    totalTrades: number;
  }> {
    const db = getFirebaseDb();
    if (!db) throw new Error('Firestore non initialisé');

    const tradesRef = getUserTradesRef(userId);
    if (!tradesRef) throw new Error('Référence utilisateur introuvable');

    // 1. Fetch Remote Firestore Trades with timeout
    const remoteTradesMap = new Map<string, Trade>();
    try {
      const remoteSnapshot = await withTimeout(
        getDocs(tradesRef),
        7000,
        'Délai de lecture Firestore dépassé'
      );
      remoteSnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Trade;
        if (data && data.id) {
          remoteTradesMap.set(data.id, data);
        }
      });
    } catch (err) {
      console.warn('Lecture Firestore initiale timée, passage au mode local:', err);
    }

    // 2. Fetch Local IndexedDB Trades
    const localTrades = await TradeRepository.getAll();
    const localTradesMap = new Map<string, Trade>();
    localTrades.forEach((t) => localTradesMap.set(t.id, t));

    let syncedToCloud = 0;
    let downloadedToLocal = 0;

    // 3. Upload missing local trades to Firestore in batches
    const tradesToUpload: Trade[] = [];
    for (const localTrade of localTrades) {
      const remote = remoteTradesMap.get(localTrade.id);
      if (!remote) {
        tradesToUpload.push(localTrade);
      } else {
        const localTime = new Date(localTrade.updatedAt || localTrade.openedAt).getTime();
        const remoteTime = new Date(remote.updatedAt || remote.openedAt).getTime();
        if (localTime > remoteTime) {
          tradesToUpload.push(localTrade);
        }
      }
    }

    if (tradesToUpload.length > 0) {
      const chunkSize = 250;
      for (let i = 0; i < tradesToUpload.length; i += chunkSize) {
        const chunk = tradesToUpload.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const trade of chunk) {
          const docRef = doc(db, 'users', userId, 'trades', trade.id);
          batch.set(docRef, sanitizeForFirestore(trade), { merge: true });
        }
        await withTimeout(batch.commit(), 8000, 'Échec de téléversement du lot de trades');
      }
      syncedToCloud = tradesToUpload.length;
    }

    // 4. Download remote trades not in IndexedDB
    const tradesToInsertLocally: Trade[] = [];
    for (const [id, remoteTrade] of remoteTradesMap.entries()) {
      if (!localTradesMap.has(id)) {
        tradesToInsertLocally.push(remoteTrade);
      }
    }

    if (tradesToInsertLocally.length > 0) {
      await TradeRepository.bulkInsert(tradesToInsertLocally, true);
      downloadedToLocal = tradesToInsertLocally.length;
    }

    // 5. Update user profile lastSync in background (non-blocking)
    const userRef = getUserDocRef(userId);
    if (userRef) {
      setDoc(
        userRef,
        {
          lastSyncAt: new Date().toISOString(),
          lastActivePlatform: 'web-pwa',
        },
        { merge: true }
      ).catch(() => {});
    }

    // 6. Sync setups and settings in parallel without blocking
    setupRepository.getAllSetups().then((setups) => {
      Promise.allSettled(setups.map((s) => this.uploadSetup(userId, s)));
    }).catch(() => {});

    SettingsRepository.get().then((settings) => {
      if (settings) {
        this.uploadSettings(userId, settings);
      }
    }).catch(() => {});

    const finalTotal = await TradeRepository.count();
    return {
      syncedToCloud,
      downloadedToLocal,
      totalTrades: finalTotal,
    };
  }

  /**
   * Subscribes to real-time changes on the user's trades collection in Firestore.
   * When any device adds, edits, or deletes a trade, this listener fires instantly.
   */
  static subscribeToTrades(
    userId: string,
    onTradesReceived: (trades: Trade[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe | null {
    const tradesRef = getUserTradesRef(userId);
    if (!tradesRef) return null;

    const q = query(tradesRef, orderBy('openedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const trades: Trade[] = [];
        snapshot.forEach((docSnap) => {
          const t = docSnap.data() as Trade;
          if (t && t.id) {
            trades.push(t);
          }
        });

        // Fire UI callback immediately so UI is responsive
        onTradesReceived(trades);

        // Update local Dexie cache asynchronously without blocking listener
        if (trades.length > 0) {
          TradeRepository.bulkInsert(trades, true).catch(() => {});
        }
      },
      (error) => {
        console.warn('Notice écoute temps réel Firestore:', error?.message || 'Listener notice');
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  }
}
