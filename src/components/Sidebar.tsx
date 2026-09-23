import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Crosshair,
  BarChart3,
  BrainCircuit,
  Settings as SettingsIcon,
  Plus,
  Sun,
  Moon,
  Sparkles,
  Sliders,
  Database,
  ShieldCheck,
  ChevronRight,
  Zap,
  Upload,
  Smartphone,
  QrCode,
  ClipboardList,
  Flame,
  LogOut,
  Cloud,
  Bot,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { CloudSyncIndicator } from './CloudSyncIndicator';

export type ActiveTab =
  | 'dashboard'
  | 'calendar'
  | 'trades'
  | 'analytics'
  | 'edge'
  | 'ai-analysis'
  | 'coach'
  | 'plans'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenCreate: () => void;
  onOpenImport: () => void;
  onOpenSetupsModal: () => void;
  onOpenBackup: () => void;
  onOpenInstall?: () => void;
  onSeed: () => void;
  isLoading?: boolean;
  tradeCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenCreate,
  onOpenImport,
  onOpenSetupsModal,
  onOpenBackup,
  onOpenInstall,
  onSeed,
  isLoading = false,
  tradeCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, signOutUser } = useAuth();

  const handleNav = (tab: ActiveTab) => {
    onTabChange(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const navGroups = [
    {
      groupTitle: 'Principal',
      items: [
        {
          id: 'dashboard' as ActiveTab,
          label: 'Dashboard',
          description: 'Vue d’ensemble & métriques',
          icon: LayoutDashboard,
        },
        {
          id: 'calendar' as ActiveTab,
          label: 'Calendrier',
          description: 'P&L journalier & recap mensuel',
          icon: CalendarDays,
        },
        {
          id: 'trades' as ActiveTab,
          label: 'Journal de Trades',
          description: `${tradeCount} positions enregistrées`,
          icon: BookOpen,
          badge: tradeCount > 0 ? String(tradeCount) : undefined,
        },
      ],
    },
    {
      groupTitle: 'Analyser',
      items: [
        {
          id: 'analytics' as ActiveTab,
          label: 'Statistiques',
          description: 'Underwater equity & sessions',
          icon: BarChart3,
        },
        {
          id: 'edge' as ActiveTab,
          label: 'My Edge Analyzer',
          description: 'Matrice SMC & setups',
          icon: Crosshair,
        },
        {
          id: 'ai-analysis' as ActiveTab,
          label: 'Analyse IA',
          description: 'Audit exécutif & fuites de capital',
          icon: BrainCircuit,
          highlight: true,
          badge: 'Audit',
        },
        {
          id: 'coach' as ActiveTab,
          label: 'Coach IA',
          description: 'Discussion interactive & requêtes ciblées',
          icon: Bot,
          highlight: true,
          badge: 'Chat',
        },
      ],
    },
    {
      groupTitle: 'Ma méthode',
      items: [
        {
          id: 'plans' as ActiveTab,
          label: 'Plans & Stratégies',
          description: 'Checklist & règles d’exécution',
          icon: ClipboardList,
        },
      ],
    },
    {
      groupTitle: 'Paramètres',
      items: [
        {
          id: 'settings' as ActiveTab,
          label: 'Terminal Settings',
          description: 'Devise, capital & paramètres',
          icon: SettingsIcon,
        },
      ],
    },
  ];

  const sidebarContent = (
    <aside
      id="thunder-edge-sidebar"
      className="flex flex-col h-full bg-white dark:bg-[#131820] border-r border-slate-200/80 dark:border-[#1E2532] text-[#1A1D23] dark:text-[#E6E8EB] select-none transition-colors duration-150"
    >
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#1E2532] flex items-center justify-between">
        <button
          onClick={() => handleNav('dashboard')}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-[#7C3AED] dark:bg-[#8B5CF6] flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform duration-150">
              <Zap className="w-5 h-5 fill-white text-white stroke-[2]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10B981] border-2 border-white dark:border-[#131820] rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black tracking-tight text-[#1A1D23] dark:text-[#E6E8EB]">
                THUNDER<span className="text-[#7C3AED] dark:text-[#8B5CF6] ml-0.5">EDGE</span>
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-violet-50 dark:bg-violet-950/60 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40">
                PRO
              </span>
            </div>
            <span className="text-[11px] text-[#6B7280] dark:text-[#8B92A0] block font-medium">
              Institutional Edge Terminal
            </span>
          </div>
        </button>
      </div>

      {/* Primary Action Button */}
      <div className="p-4 pb-2">
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          id="sidebar-btn-log-trade"
          onClick={() => {
            onOpenCreate();
            if (onCloseMobile) onCloseMobile();
          }}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] dark:bg-[#8B5CF6] dark:hover:bg-[#7C3AED] text-white text-xs font-bold shadow-xs transition-colors duration-150 cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Nouveau Trade</span>
        </motion.button>
      </div>

      {/* Grouped Vertical Navigation List */}
      <div className="flex-1 px-3 py-2 space-y-4 overflow-y-auto" aria-label="Main navigation menu">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.groupTitle}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`sidebar-nav-${item.id}`}
                  onClick={() => handleNav(item.id)}
                  className={`w-full relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors duration-150 group ${
                    isActive
                      ? 'font-bold text-[#7C3AED] dark:text-[#8B5CF6]'
                      : 'font-semibold text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100/80 dark:hover:bg-[#181F2A]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 rounded-xl shadow-xs"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg transition-all duration-150 ${
                        isActive
                          ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white shadow-xs scale-105'
                          : 'bg-slate-100 dark:bg-[#181F2A] text-slate-500 dark:text-[#8B92A0] group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6] group-hover:scale-105'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{item.label}</span>
                        {item.highlight && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                        )}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 dark:text-[#5E6676] truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`relative z-10 px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                        isActive
                          ? 'bg-[#7C3AED] dark:bg-[#8B5CF6] text-white'
                          : 'bg-slate-200 dark:bg-[#181F2A] text-slate-700 dark:text-[#8B92A0]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Setups Manager under Ma méthode */}
            {group.groupTitle === 'Ma méthode' && (
              <button
                id="sidebar-btn-setups-manager"
                onClick={() => {
                  onOpenSetupsModal();
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A] border border-transparent cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#181F2A] text-slate-500 dark:text-[#8B92A0] group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6]">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-slate-800 dark:text-[#E6E8EB]">Setups Manager</span>
                    <div className="text-[10px] font-medium text-slate-400 dark:text-[#5E6676]">
                      FVG, CISD, MSS models
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        ))}

        {/* Outils Quick Actions */}
        <div className="space-y-1 pt-1">
          <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#5E6676]">
            Outils &amp; Données
          </div>

          {/* Universal Import */}
          <button
            id="sidebar-btn-import"
            onClick={() => {
              onOpenImport();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A] border border-transparent cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-[#7C3AED] dark:text-[#8B5CF6] border border-violet-200/60 dark:border-violet-800/40">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-800 dark:text-[#E6E8EB]">Importer des Trades</span>
                <div className="text-[10px] font-medium text-slate-400 dark:text-[#5E6676]">
                  CSV, MT4/MT5, Excel, PDF
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Backup Modal trigger */}
          <button
            id="sidebar-btn-backup"
            onClick={() => {
              onOpenBackup();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] hover:bg-slate-100 dark:hover:bg-[#181F2A] border border-transparent cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#181F2A] text-slate-500 dark:text-[#8B92A0] group-hover:text-[#7C3AED] dark:group-hover:text-[#8B5CF6]">
                <Database className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-slate-800 dark:text-[#E6E8EB]">Backup &amp; Export</span>
                <div className="text-[10px] font-medium text-slate-400 dark:text-[#5E6676]">
                  Snapshot JSON &amp; CSV
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* PWA Mobile Install trigger */}
          {onOpenInstall && (
            <button
              id="sidebar-btn-install-app"
              onClick={() => {
                onOpenInstall();
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-[#7C3AED] dark:text-[#8B5CF6] bg-violet-50/80 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 border border-violet-200/60 dark:border-violet-800/40 cursor-pointer shadow-xs mt-1 transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-500/20 text-[#7C3AED] dark:text-[#8B5CF6]">
                  <QrCode className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span>Scanner QR Code</span>
                    <span className="px-1 py-0.2 text-[8px] uppercase font-black rounded bg-[#7C3AED] dark:bg-[#8B5CF6] text-white">
                      Mobile
                    </span>
                  </div>
                  <div className="text-[10px] font-medium opacity-80 text-slate-500 dark:text-[#8B92A0]">
                    Ouvrir sur iPhone &amp; Android
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#8B5CF6] group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Footer / Status & Theme Switcher */}
      <div className="p-4 border-t border-slate-200/80 dark:border-[#1E2532] space-y-3 bg-slate-50/60 dark:bg-[#0A0E14]">
        {/* Theme Switcher Card */}
        <div className="p-2 rounded-xl bg-white dark:bg-[#131820] border border-slate-200 dark:border-[#1E2532] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
            {isDark ? (
              <Moon className="w-4 h-4 text-[#8B5CF6]" />
            ) : (
              <Sun className="w-4 h-4 text-[#7C3AED]" />
            )}
            <span>{isDark ? 'Mode Sombre' : 'Mode Clair'}</span>
          </div>

          <button
            id="sidebar-theme-toggle"
            type="button"
            onClick={toggleTheme}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none ${
              isDark ? 'bg-[#8B5CF6]' : 'bg-slate-300'
            }`}
            role="switch"
            aria-checked={isDark}
            aria-label="Toggle Theme Mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-150 ease-in-out ${
                isDark ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* User Account / Session Profile */}
        {user ? (
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#181F2A] border border-slate-200 dark:border-[#1E2532] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Utilisateur'}
                  className="w-7 h-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#7C3AED] dark:bg-[#8B5CF6] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#1A1D23] dark:text-[#E6E8EB] truncate">
                  {user.displayName || user.email}
                </p>
                <div className="pt-1">
                  <CloudSyncIndicator compact />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={signOutUser}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#EF4444] hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}

        {/* Storage status indicator */}
        <div className="flex items-center justify-between text-[10px] text-[#6B7280] dark:text-[#8B92A0] px-1 font-mono">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-[#10B981]" />
            <span>IndexedDB Local</span>
          </div>
          <span className="font-bold text-[#7C3AED] dark:text-[#8B5CF6]">Cloud Sync Actif</span>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Persistent Left Sidebar (Visible on large screens lg+) */}
      <div className="hidden lg:block w-64 xl:w-72 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </div>

      {/* Mobile & Tablet Drawer Overlay (Visible below lg) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Drawer container */}
          <div className="relative w-72 max-w-[80vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
