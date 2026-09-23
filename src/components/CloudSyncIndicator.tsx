import React, { useState } from 'react';
import { Cloud, CloudCheck, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useCloudSync } from '../hooks/useCloudSync';
import { useAuth } from '../contexts/AuthContext';

interface CloudSyncIndicatorProps {
  compact?: boolean;
}

export const CloudSyncIndicator: React.FC<CloudSyncIndicatorProps> = ({ compact = false }) => {
  const { user } = useAuth();
  const { state, lastSyncedAt, isSyncing, error, triggerSync } = useCloudSync();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!user) return null;

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'En attente';
    const diffSeconds = Math.floor((Date.now() - lastSyncedAt.getTime()) / 1000);
    if (diffSeconds < 60) return 'À l\'instant';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Il y a ${diffMinutes}m`;
    return lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => triggerSync()}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isSyncing}
        title="Cliquer pour forcer la synchronisation Cloud"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border ${
          state === 'syncing'
            ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
            : state === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            : state === 'offline'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
        }`}
      >
        {state === 'syncing' ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
        ) : state === 'error' ? (
          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        ) : state === 'offline' ? (
          <CloudOff className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
        )}

        {!compact && (
          <span className="hidden sm:inline font-mono text-[10.5px]">
            {state === 'syncing'
              ? 'Sync en cours...'
              : state === 'error'
              ? 'Erreur sync'
              : state === 'offline'
              ? 'Hors-ligne'
              : `Cloud Sync (${formatLastSync()})`}
          </span>
        )}
      </button>

      {/* Hover Info Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl text-[11px] text-slate-200 z-50 backdrop-blur-md pointer-events-none">
          <p className="font-semibold text-white mb-1 flex items-center justify-between">
            <span>Synchronisation Firestore</span>
            <span
              className={`w-2 h-2 rounded-full ${
                state === 'synced'
                  ? 'bg-emerald-400'
                  : state === 'syncing'
                  ? 'bg-violet-400 animate-ping'
                  : 'bg-amber-400'
              }`}
            />
          </p>
          <p className="text-slate-400 leading-relaxed mb-2">
            Vos trades, setups et configurations sont répliqués en temps réel sur le cloud sécurisé et disponibles instantanément sur tous vos appareils.
          </p>
          <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Dernière synchro :</span>
            <span className="text-slate-300 font-semibold">{formatLastSync()}</span>
          </div>
          {error && (
            <p className="mt-1 text-[10px] text-rose-400 font-mono">{error}</p>
          )}
        </div>
      )}
    </div>
  );
};
