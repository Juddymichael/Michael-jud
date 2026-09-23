import React from 'react';
import { ActiveTab } from './Sidebar';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  BarChart3,
  BrainCircuit,
  Plus,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenCreate: () => void;
  onOpenMenu: () => void;
  onOpenInstall: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenCreate,
  onOpenMenu,
  onOpenInstall,
  isInstallable,
  isInstalled,
}) => {
  return (
    <nav
      aria-label="Navigation mobile et tablette"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#131820]/95 backdrop-blur-lg border-t border-slate-200/60 dark:border-[#1C2430] px-2 sm:px-6 py-1.5 pb-safe shadow-lg select-none"
    >
      <div className="flex items-center justify-around max-w-md md:max-w-xl mx-auto">
        {/* Dashboard */}
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[54px] ${
            activeTab === 'dashboard'
              ? 'text-[#7C3AED] dark:text-[#8B5CF6] font-bold scale-105'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15'
                : 'bg-transparent'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Dashboard</span>
        </button>

        {/* Analytics / Stats */}
        <button
          onClick={() => onTabChange('analytics')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[54px] ${
            activeTab === 'analytics'
              ? 'text-[#7C3AED] dark:text-[#8B5CF6] font-bold scale-105'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-colors ${
              activeTab === 'analytics'
                ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15'
                : 'bg-transparent'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Stats</span>
        </button>

        {/* Central Action: + New Trade */}
        <div className="relative -top-2 flex flex-col items-center">
          <button
            onClick={onOpenCreate}
            className="w-12 h-12 rounded-full bg-[#7C3AED] dark:bg-[#8B5CF6] text-white flex items-center justify-center shadow-md active:scale-95 transition-transform duration-150 cursor-pointer border-2 border-white dark:border-[#131820]"
            aria-label="Ajouter un trade"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>
          <span className="text-[9px] font-bold text-[#1A1D23] dark:text-[#E6E8EB] mt-0.5">
            + Trade
          </span>
        </div>

        {/* Analyse IA */}
        <button
          onClick={() => onTabChange('ai-analysis')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[54px] ${
            activeTab === 'ai-analysis'
              ? 'text-[#7C3AED] dark:text-[#8B5CF6] font-bold scale-105'
              : 'text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <div
            className={`p-1 rounded-lg transition-colors ${
              activeTab === 'ai-analysis'
                ? 'bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15'
                : 'bg-transparent'
            }`}
          >
            <BrainCircuit className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Analyse IA</span>
        </button>

        {/* Menu (Drawer) */}
        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[54px] text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB]"
        >
          <div className="p-1 rounded-lg">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Menu</span>
        </button>
      </div>
    </nav>
  );
};
