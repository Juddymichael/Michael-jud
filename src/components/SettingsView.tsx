import React, { useState } from 'react';
import { UserSettings, AppTheme } from '../types/settings';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  Database,
  Trash2,
  Sparkles,
  Save,
  CheckCircle2,
  ShieldCheck,
  LogOut,
  Cloud,
} from 'lucide-react';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (partial: Partial<UserSettings>) => Promise<void>;
  onOpenBackup: () => void;
  onSeed: () => void;
  onClear: () => void;
  tradeCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onOpenBackup,
  onSeed,
  onClear,
  tradeCount,
}) => {
  const { theme, setTheme } = useTheme();
  const { user, signInWithGoogle, signOutUser } = useAuth();
  const [currency, setCurrency] = useState(settings.currency || 'EUR');
  const [initialBalance, setInitialBalance] = useState(String(settings.initialAccountBalance || 10000));
  const [defaultRisk, setDefaultRisk] = useState(String(settings.defaultRisk || 1.0));
  const [timezone, setTimezone] = useState(settings.timezone || 'UTC');
  const [postLossAlertWindowMinutes, setPostLossAlertWindowMinutes] = useState(String(settings.postLossAlertWindowMinutes ?? 60));
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    if (settings.currency) setCurrency(settings.currency);
    if (settings.initialAccountBalance) setInitialBalance(String(settings.initialAccountBalance));
    if (settings.defaultRisk !== undefined && settings.defaultRisk !== null) setDefaultRisk(String(settings.defaultRisk));
    if (settings.timezone) setTimezone(settings.timezone);
    if (settings.postLossAlertWindowMinutes !== undefined && settings.postLossAlertWindowMinutes !== null) {
      setPostLossAlertWindowMinutes(String(settings.postLossAlertWindowMinutes));
    }
  }, [settings.currency, settings.initialAccountBalance, settings.defaultRisk, settings.timezone, settings.postLossAlertWindowMinutes]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings({
      currency,
      initialAccountBalance: parseFloat(initialBalance) || 10000,
      defaultRisk: parseFloat(defaultRisk) || 1.0,
      timezone,
      postLossAlertWindowMinutes: Math.max(1, parseInt(postLossAlertWindowMinutes, 10) || 60),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6" id="view-settings">
      {/* Header */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Terminal Preferences &amp; Configuration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
              Account currency, starting balance, timezone, session killzones, and theme
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme Preference Selection */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xs space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Color Theme</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'dark' as AppTheme, label: 'Dark Terminal', icon: Moon, desc: 'Deep Navy & Electric Indigo' },
              { id: 'light' as AppTheme, label: 'Light Studio', icon: Sun, desc: 'Clean White & Crisp Violet' },
              { id: 'system' as AppTheme, label: 'System Sync', icon: Laptop, desc: 'Follows OS mode' },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.id;
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`p-4 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-medium text-xs text-slate-900 dark:text-slate-100 block">
                      {t.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                      {t.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Account & Calculations Configuration */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Account &amp; Financial Risk Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Account Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CHF">CHF (Fr)</option>
                <option value="AUD">AUD ($)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Starting Balance
              </label>
              <input
                type="number"
                step="any"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Default Target Risk (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={defaultRisk}
                onChange={(e) => setDefaultRisk(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
              </select>
            </div>
          </div>

          {/* Vigilance Anti-Revenge Trading */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="max-w-xl">
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Fenêtre de vigilance post-perte (minutes)
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  step="5"
                  value={postLossAlertWindowMinutes}
                  onChange={(e) => setPostLossAlertWindowMinutes(e.target.value)}
                  className="w-32 px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 tabular-nums font-medium"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Alerte comportementale affichée lors de la saisie d'un nouveau trade après un stop loss (valeur par défaut : 60 min).
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Settings saved successfully
              </span>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </form>

      {/* Firebase Cloud Sync & Google Account */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Compte Firebase &amp; Synchronisation Cloud
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Base de données Firestore : <span className="font-mono text-violet-400">ai-studio-thunderedge-cdb8205d-38a0-4abe-913d-38d57277928c</span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0D121D] border border-slate-200/80 dark:border-[#1E2532] flex items-center justify-between flex-wrap gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Utilisateur'}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-violet-500/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {user.displayName || 'Trader Institutionnel'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    Connecté Google
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {user.email}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  UID : <span className="font-mono text-[9px]">{user.uid}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-amber-500">
                  Mode Essai Local (Non connecté)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Connectez votre compte Google pour synchroniser vos trades, vos setups et vos conversations du Coach IA instantanément sur Firestore.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={() => signOutUser()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Se déconnecter</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signInWithGoogle().catch((e) => console.error(e))}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-white text-slate-900 hover:bg-slate-100 shadow-md transition cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                  <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z" />
                </svg>
                <span>Connexion avec Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Database Maintenance & Backups */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101827] shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          <span>Local IndexedDB Data Management</span>
        </h3>

        <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
            Currently storing <span className="font-semibold text-slate-900 dark:text-slate-200 tabular-nums">{tradeCount} trades</span> in browser local storage.
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onSeed}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Load Seed Data</span>
            </button>

            <button
              onClick={onOpenBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Export / Backup</span>
            </button>

            {tradeCount > 0 && (
              <button
                onClick={onClear}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Database</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

