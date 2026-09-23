import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCloudSyncStore, SyncState } from '../stores/useCloudSyncStore';

export type { SyncState };

export interface CloudSyncInfo {
  state: SyncState;
  lastSyncedAt: Date | null;
  isSyncing: boolean;
  isOnline: boolean;
  error: string | null;
  triggerSync: () => Promise<void>;
}

export function useCloudSync(): CloudSyncInfo {
  const { user } = useAuth();
  const state = useCloudSyncStore((s) => s.state);
  const lastSyncedAt = useCloudSyncStore((s) => s.lastSyncedAt);
  const error = useCloudSyncStore((s) => s.error);
  const isOnline = useCloudSyncStore((s) => s.isOnline);
  const setOnline = useCloudSyncStore((s) => s.setOnline);
  const initializeSync = useCloudSyncStore((s) => s.initializeSync);
  const triggerSyncAction = useCloudSyncStore((s) => s.triggerSync);
  const cleanup = useCloudSyncStore((s) => s.cleanup);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (user) {
        triggerSyncAction();
      }
    };
    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, setOnline, triggerSyncAction]);

  // Synchronize when authenticated user changes
  useEffect(() => {
    if (user?.uid) {
      initializeSync(user.uid);
    } else {
      cleanup();
    }
  }, [user?.uid, initializeSync, cleanup]);

  const triggerSync = useCallback(async () => {
    await triggerSyncAction();
  }, [triggerSyncAction]);

  return {
    state,
    lastSyncedAt,
    isSyncing: state === 'syncing',
    isOnline,
    error,
    triggerSync,
  };
}
