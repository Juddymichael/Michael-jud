import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Sparkles, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MobileInstallBannerProps {
  onOpenModal: () => void;
}

export const MobileInstallBanner: React.FC<MobileInstallBannerProps> = ({ onOpenModal }) => {
  const { isInstalled, isMobile } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('thunder_edge_pwa_banner_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('thunder_edge_pwa_banner_dismissed', 'true');
  };

  // Hide if already running in standalone PWA or user dismissed or desktop
  if (isInstalled || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="block sm:hidden fixed top-16 left-3 right-3 z-30 p-3 rounded-2xl bg-white/95 dark:bg-[#131820]/95 border border-slate-200/60 dark:border-[#1C2430] shadow-xl backdrop-blur-md text-[#1A1D23] dark:text-[#E6E8EB]"
      >
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] shrink-0 flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[#1A1D23] dark:text-[#E6E8EB] truncate">Installer Thunder Edge</span>
                <span className="px-1.5 py-0.2 text-[8px] font-bold rounded bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/20 uppercase font-mono">
                  App
                </span>
              </div>
              <p className="text-[10px] text-[#6B7280] dark:text-[#8B92A0] truncate">
                Accès direct depuis votre écran d&apos;accueil
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenModal}
              className="px-3 py-1.5 rounded-xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white text-[11px] font-bold shadow-xs cursor-pointer active:scale-95 transition-transform"
            >
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#8B92A0] hover:text-[#1A1D23] dark:hover:text-[#E6E8EB] transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
