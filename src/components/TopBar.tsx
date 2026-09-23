import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Plus,
  Sun,
  Moon,
  Sparkles,
  Sliders,
  Database,
  Radio,
  Crosshair,
  BarChart3,
  BrainCircuit,
  Settings as SettingsIcon,
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Upload,
  Smartphone,
  QrCode,
  ClipboardList,
  LogOut,
  User as UserIcon,
  MoreHorizontal,
  ChevronDown,
  Bot,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { ActiveTab } from './Sidebar';
import { motion, AnimatePresence } from 'motion/react';
import { CloudSyncIndicator } from './CloudSyncIndicator';
import { getKillzoneInfoFromDate } from '../lib/sessionCalculator';

interface TopBarProps {
  activeTab: ActiveTab;
  onOpenMobileMenu: () => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onOpenSetupsModal: () => void;
  onOpenBackup: () => void;
  onOpenInstall?: () => void;
  onSeed: () => void;
  isLoading?: boolean;
  tradeCount: number;
}

const TAB_INFO: Record<ActiveTab, { title: string; subtitle: string; icon: React.FC<{ className?: string }> }> = {
  dashboard: {
    title: 'Performance Dashboard',
    subtitle: 'Vue d’ensemble des métriques institutionnelles et croissance du capital',
    icon: LayoutDashboard,
  },
  calendar: {
    title: 'Calendrier de Trading',
    subtitle: 'Matrice de P&L journalier, gains nets et décomposition hebdomadaire',
    icon: CalendarDays,
  },
  trades: {
    title: 'Journal de Trades',
    subtitle: 'Grand livre complet de vos exécutions, graphiques et calculs de R',
    icon: BookOpen,
  },
  analytics: {
    title: 'Statistiques & Drawdown',
    subtitle: 'Underwater equity curve, winrate glissant et performance par session',
    icon: BarChart3,
  },
  edge: {
    title: 'My Edge Analyzer',
    subtitle: 'Matrice de setups SMC, espérance mathématique et rentabilité',
    icon: Crosshair,
  },
  'ai-analysis': {
    title: 'Analyse IA & Audit Exécutif',
    subtitle: 'Diagnostic quantitatif, 4 graphiques clés et alertes de fuites de capital',
    icon: BrainCircuit,
  },
  coach: {
    title: 'Coach IA Conversationnel',
    subtitle: 'Dialogue interactif & requêtes quantitatives ciblées via Function Calling',
    icon: Bot,
  },
  plans: {
    title: 'Plans & Stratégies',
    subtitle: 'Checklist de pré-session, règles de risque et discipline d’exécution',
    icon: ClipboardList,
  },
  settings: {
    title: 'Terminal Settings',
    subtitle: 'Devise, capital de départ, fuseau horaire et préférences',
    icon: SettingsIcon,
  },
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onOpenMobileMenu,
  onOpenCreate,
  onOpenImport,
  onOpenSetupsModal,
  onOpenBackup,
  onOpenInstall,
  onSeed,
  isLoading = false,
  tradeCount,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOutUser, signInWithGoogle } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const info = TAB_INFO[activeTab] || TAB_INFO.dashboard;
  const Icon = info.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <header
      id="thunder-edge-topbar"
      className="sticky top-0 z-20 h-16 border-b border-slate-200/80 dark:border-[#1E2532] bg-[#F7F8FA]/90 dark:bg-[#0A0E14]/90 backdrop-blur-md transition-colors duration-150 px-4 sm:px-6 flex items-center justify-between"
    >
      {/* Left: Mobile & Tablet Toggle & Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-[#8B92A0] hover:bg-slate-100 dark:hover:bg-[#131820] focus:outline-none cursor-pointer"
          aria-label="Ouvrir le menu de navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="hidden sm:flex p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40 shrink-0 shadow-xs">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate flex items-center gap-2">
              <span>{info.title}</span>
            </h1>
            <p className="hidden lg:block text-[11px] font-medium text-[#6B7280] dark:text-[#8B92A0] truncate">
              {info.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* SMC Killzone Pill (Madagascar Time UTC+3) */}
        {(() => {
          const currentKz = getKillzoneInfoFromDate(new Date(), 'Indian/Antananarivo');
          const isKzActive = currentKz.code !== 'OFF_HOURS';
          return (
            <div
              className={`hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                isKzActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100/70 dark:bg-[#131820] border-slate-200 dark:border-[#1E2532] text-slate-500 dark:text-[#8B92A0]'
              }`}
              title={`Horaires de Madagascar (UTC+3) : ${currentKz.madagascarHours} (Converti depuis ${currentKz.nyHours})`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isKzActive ? 'bg-[#10B981] animate-pulse' : 'bg-slate-400'
                }`}
              />
              <Radio className={`w-3 h-3 ${isKzActive ? 'text-[#10B981]' : 'text-slate-400'}`} />
              <span>
                {isKzActive
                  ? `${currentKz.name} (${currentKz.madagascarHours})`
                  : 'Hors Killzone'}
              </span>
            </div>
          );
        })()}

        {/* Theme Toggle Button */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={toggleTheme}
          className="p-1.5 sm:p-2 rounded-xl text-slate-700 dark:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#131820] transition-all border border-slate-200 dark:border-[#1E2532] cursor-pointer shadow-xs"
          title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label="Changer le thème"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8B5CF6]" />
          ) : (
            <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#7C3AED]" />
          )}
        </motion.button>

        {/* Real-time Cloud Sync Indicator */}
        <CloudSyncIndicator />

        {/* Quick Google Sign-In button if guest */}
        {!user && (
          <button
            type="button"
            onClick={() => signInWithGoogle().catch((e) => console.error(e))}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#131820] hover:bg-slate-50 dark:hover:bg-[#181F2A] border border-slate-200 dark:border-[#1E2532] text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs transition cursor-pointer"
            title="Connectez votre compte Google pour activer la synchronisation Firestore"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z" />
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
              <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z" />
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z" />
            </svg>
            <span>Connexion Google</span>
          </button>
        )}

        {/* Consolidated Profile & Secondary Tools Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              menuOpen
                ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-300 dark:border-violet-700 text-[#7C3AED] dark:text-[#8B5CF6]'
                : 'bg-white dark:bg-[#131820] border-slate-200 dark:border-[#1E2532] text-[#1A1D23] dark:text-[#E6E8EB] hover:bg-slate-50 dark:hover:bg-[#181F2A]'
            }`}
            title="Options et profil utilisateur"
            aria-expanded={menuOpen}
          >
            {user ? (
              <>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Utilisateur'}
                    className="w-4 h-4 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-bold">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline max-w-[90px] truncate text-[11px]">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              </>
            ) : (
              <>
                <MoreHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline text-[11px]">Menu</span>
              </>
            )}
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                menuOpen ? 'rotate-180 text-violet-600 dark:text-violet-400' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#131820] border border-slate-200/80 dark:border-[#1E2532] shadow-xl p-2 z-50 text-xs"
              >
                {/* User Section */}
                {user ? (
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#181F2A] mb-2 border border-slate-100 dark:border-[#222B3A]">
                    <div className="flex items-center gap-2.5">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'Utilisateur'}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-violet-500/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#7C3AED] dark:bg-[#8B5CF6] text-white flex items-center justify-center font-bold text-xs">
                          {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate text-xs">
                          {user.displayName || 'Trader'}
                        </div>
                        <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-[#1E2532] flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#10B981]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                        Connecté Firebase
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          signOutUser();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EF4444] hover:underline cursor-pointer"
                      >
                        <LogOut className="w-3 h-3" />
                        Déconnexion
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 mb-2 border border-violet-200 dark:border-violet-900/50">
                    <div className="text-xs font-bold text-violet-900 dark:text-violet-200 mb-1">
                      Mode Invité Local
                    </div>
                    <p className="text-[10px] text-violet-700 dark:text-violet-300 leading-tight mb-2.5">
                      Connectez votre compte Google pour activer la synchronisation Firestore multi-appareils.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        signInWithGoogle().catch((e) => console.error(e));
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-white dark:bg-white text-slate-900 text-xs font-bold shadow-xs hover:bg-slate-50 transition cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z" />
                        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                        <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.8 0 12s.7 3.2 1.9 5.6l3.7-2.9z" />
                        <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16c1.8 3.8 5.6 7 10.1 7z" />
                      </svg>
                      <span>Connexion avec Google</span>
                    </button>
                  </div>
                )}

                {/* Secondary Actions */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenImport();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-slate-700 dark:text-[#E6E8EB] hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <div>
                      <div className="font-semibold text-xs">Importer des trades</div>
                      <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">CSV, Excel, MT4/MT5, PDF</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSetupsModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-slate-700 dark:text-[#E6E8EB] hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition cursor-pointer"
                  >
                    <Sliders className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <div>
                      <div className="font-semibold text-xs">Gestionnaire de setups</div>
                      <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">Setups SMC &amp; critères</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenBackup();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-slate-700 dark:text-[#E6E8EB] hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition cursor-pointer"
                  >
                    <Database className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                    <div>
                      <div className="font-semibold text-xs">Sauvegarde &amp; Export</div>
                      <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">Restauration &amp; exports JSON</div>
                    </div>
                  </button>

                  {onOpenInstall && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenInstall();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-slate-700 dark:text-[#E6E8EB] hover:bg-violet-50 dark:hover:bg-violet-950/40 hover:text-[#7C3AED] dark:hover:text-[#8B5CF6] transition cursor-pointer"
                    >
                      <QrCode className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                      <div>
                        <div className="font-semibold text-xs">Installer sur Mobile</div>
                        <div className="text-[10px] text-[#6B7280] dark:text-[#8B92A0]">Afficher le QR code PWA</div>
                      </div>
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary CTA: Log Trade */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenCreate}
          disabled={isLoading}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Nouveau Trade</span>
        </motion.button>
      </div>
    </header>
  );
};
