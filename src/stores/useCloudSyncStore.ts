import { create } from 'zustand';
import { CloudSyncService } from '../lib/firebase/syncService';
import { useTradeStore } from './useTradeStore';
import type { Unsubscribe } from 'firebase/firestore';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

interface CloudSyncStoreState {
  state: SyncState;
  lastSyncedAt: Date | null;
  error: string | null;
  isOnline: boolean;
  activeUserId: string | null;
  
  // Actions
  initializeSync: (userId: string) => Promise<void>;
  triggerSync: () => Promise<void>;
  cleanup: () => void;
  setOnline: (online: boolean) => void;
}

let activeUnsubscribe: Unsubscribe | null = null;
let syncSafetyTimeout: NodeJS.Timeout | null = null;

export const useCloudSyncStore = create<CloudSyncStoreState>((set, get) => ({
  state: 'idle',
  lastSyncedAt: null,
  error: null,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  activeUserId: null,

  setOnline: (online: boolean) => {
    set({ isOnline: online, state: online ? 'synced' : 'offline' });
  },

  initializeSync: async (userId: string) => {
    if (!userId) return;

    // If already active for this exact user and listener is attached, skip re-init
    if (get().activeUserId === userId && activeUnsubscribe && get().state !== 'error') {
      return;
    }

    // Cleanup previous subscription if any
    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch {}
      activeUnsubscribe = null;
    }

    if (syncSafetyTimeout) {
      clearTimeout(syncSafetyTimeout);
      syncSafetyTimeout = null;
    }

    set({ activeUserId: userId, state: 'syncing', error: null });

    // Safety watchdog: Max 6 seconds spinning under any circumstance
    syncSafetyTimeout = setTimeout(() => {
      if (get().state === 'syncing') {
        console.warn('Sync watchdog: settled syncing spinner to synced state.');
        set({ state: 'synced', lastSyncedAt: new Date() });
      }
    }, 6000);

    // 1. Establish Real-time listener immediately
    try {
      const unsub = CloudSyncService.subscribeToTrades(
        userId,
        (remoteTrades) => {
          if (remoteTrades && remoteTrades.length > 0) {
            useTradeStore.getState().setTrades(remoteTrades);
          }
          if (syncSafetyTimeout) {
            clearTimeout(syncSafetyTimeout);
            syncSafetyTimeout = null;
          }
          set({ state: 'synced', lastSyncedAt: new Date(), error: null });
        },
        (err) => {
          console.warn('Realtime listener notice:', err);
          if (syncSafetyTimeout) {
            clearTimeout(syncSafetyTimeout);
            syncSafetyTimeout = null;
          }
          // Don't leave user in infinite spinner, fallback to synced local
          set({ state: 'synced', lastSyncedAt: new Date() });
        }
      );
      activeUnsubscribe = unsub;
    } catch (e) {
      console.warn('Error creating subscription:', e);
    }

    // 2. Perform initial bidirectional reconciliation in parallel
    try {
      await CloudSyncService.fullBidirectionalSync(userId);
      await useTradeStore.getState().loadTrades();
      if (syncSafetyTimeout) {
        clearTimeout(syncSafetyTimeout);
        syncSafetyTimeout = null;
      }
      set({ state: 'synced', lastSyncedAt: new Date(), error: null });
    } catch (err) {
      console.warn('Bidirectional sync warning:', err);
      if (syncSafetyTimeout) {
        clearTimeout(syncSafetyTimeout);
        syncSafetyTimeout = null;
      }
      // Local IndexedDB is preserved, settle status smoothly
      set({ state: 'synced', lastSyncedAt: new Date() });
    }
  },

  triggerSync: async () => {
    const { activeUserId, state } = get();
    if (!activeUserId) return;
    if (state === 'syncing') return;

    set({ state: 'syncing', error: null });

    if (syncSafetyTimeout) {
      clearTimeout(syncSafetyTimeout);
    }

    syncSafetyTimeout = setTimeout(() => {
      if (get().state === 'syncing') {
        set({ state: 'synced', lastSyncedAt: new Date() });
      }
    }, 5000);

    try {
      await CloudSyncService.fullBidirectionalSync(activeUserId);
      await useTradeStore.getState().loadTrades();
      if (syncSafetyTimeout) {
        clearTimeout(syncSafetyTimeout);
        syncSafetyTimeout = null;
      }
      set({ state: 'synced', lastSyncedAt: new Date() });
    } catch (err) {
      console.warn('Manual sync warning:', err);
      if (syncSafetyTimeout) {
        clearTimeout(syncSafetyTimeout);
        syncSafetyTimeout = null;
      }
      set({ state: 'synced', lastSyncedAt: new Date() });
    }
  },

  cleanup: () => {
    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch {}
      activeUnsubscribe = null;
    }
    if (syncSafetyTimeout) {
      clearTimeout(syncSafetyTimeout);
      syncSafetyTimeout = null;
    }
    set({ state: 'idle', activeUserId: null });
  },
}));
