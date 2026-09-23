import { create } from 'zustand';
import { Trade, NewTradeInput } from '../types/trade';
import { TradeRepository } from '../lib/database/repositories/tradeRepository';
import { SEED_TRADES } from '../data/seedTrades';
import { calculateComprehensiveMetrics } from '../lib/calculations';
import { ComprehensivePerformanceMetrics } from '../types/calculations';
import { getFirebaseAuth } from '../lib/firebase/config';
import { CloudSyncService } from '../lib/firebase/syncService';

interface TradeState {
  trades: Trade[];
  isLoading: boolean;
  error: string | null;
  selectedTrade: Trade | null;

  // Actions
  loadTrades: () => Promise<void>;
  setTrades: (trades: Trade[]) => void;
  addTrade: (input: NewTradeInput) => Promise<Trade>;
  removeTrade: (id: string) => Promise<void>;
  clearAllTrades: () => Promise<void>;
  seedDatabase: () => Promise<{ inserted: number; duplicates: number }>;
  setSelectedTrade: (trade: Trade | null) => void;
  getMetrics: (initialBalance?: number) => ComprehensivePerformanceMetrics;
}

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  isLoading: false,
  error: null,
  selectedTrade: null,

  loadTrades: async () => {
    set({ isLoading: true, error: null });
    try {
      const trades = await TradeRepository.getAll();
      set({ trades, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load trades',
      });
    }
  },

  setTrades: (trades: Trade[]) => {
    set({ trades, isLoading: false });
  },

  addTrade: async (input: NewTradeInput) => {
    set({ isLoading: true, error: null });
    try {
      const saved = await TradeRepository.create(input);
      const trades = await TradeRepository.getAll();
      set({ trades, isLoading: false });

      // Sync to Firestore if user is authenticated
      const uid = getFirebaseAuth()?.currentUser?.uid;
      if (uid) {
        CloudSyncService.uploadTrade(uid, saved).catch((e) =>
          console.warn('Erreur synchronisation Firestore uploadTrade:', e)
        );
      }

      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save trade';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  removeTrade: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await TradeRepository.delete(id);
      const trades = await TradeRepository.getAll();
      set({ trades, isLoading: false });

      // Sync deletion to Firestore
      const uid = getFirebaseAuth()?.currentUser?.uid;
      if (uid) {
        CloudSyncService.deleteTrade(uid, id).catch((e) =>
          console.warn('Erreur synchronisation Firestore deleteTrade:', e)
        );
      }
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to delete trade',
      });
    }
  },

  clearAllTrades: async () => {
    set({ isLoading: true, error: null });
    try {
      const currentTrades = get().trades;
      await TradeRepository.clearAll();
      set({ trades: [], isLoading: false });

      // Sync deletions to Firestore
      const uid = getFirebaseAuth()?.currentUser?.uid;
      if (uid && currentTrades.length > 0) {
        Promise.all(currentTrades.map((t) => CloudSyncService.deleteTrade(uid, t.id))).catch((e) =>
          console.warn('Erreur clear remote trades:', e)
        );
      }
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to clear trades',
      });
    }
  },

  seedDatabase: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await TradeRepository.bulkInsert(SEED_TRADES, true);
      const trades = await TradeRepository.getAll();
      set({ trades, isLoading: false });

      // Sync seed to Firestore
      const uid = getFirebaseAuth()?.currentUser?.uid;
      if (uid) {
        CloudSyncService.fullBidirectionalSync(uid).catch((e) =>
          console.warn('Erreur sync seed trades:', e)
        );
      }

      return { inserted: result.inserted, duplicates: result.duplicates };
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to seed database',
      });
      throw err;
    }
  },

  setSelectedTrade: (trade: Trade | null) => {
    set({ selectedTrade: trade });
  },

  getMetrics: (initialBalance = 10000) => {
    return calculateComprehensiveMetrics(get().trades, initialBalance);
  },
}));
