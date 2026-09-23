import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Share,
  PlusSquare,
  X,
  Smartphone,
  CheckCircle2,
  Zap,
  ShieldCheck,
  WifiOff,
  Sparkles,
  QrCode,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isMobile, install } = usePWAInstall();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Determine the best URL to open on mobile
  const rawOrigin = typeof window !== 'undefined' && window.location.origin !== 'null' && window.location.origin !== 'about:blank'
    ? window.location.origin
    : 'https://ais-pre-7tnuuhyujavfy352dktonw-915171930799.europe-west2.run.app';
  
  const appUrl = rawOrigin;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(appUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
        setInstallSuccess(false);
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-[#131820] border-t sm:border border-slate-200/60 dark:border-[#1C2430] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 max-h-[92vh] flex flex-col pb-safe"
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-slate-200/60 dark:border-[#1C2430] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#7C3AED] dark:bg-[#8B5CF6] p-0.5 shadow-xs flex items-center justify-center">
                <img
                  src="/pwa-192x192.png"
                  alt="Thunder Edge Icon"
                  className="w-full h-full rounded-[14px] object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icon.svg';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1A1D23] dark:text-[#E6E8EB]">
                    Installer sur votre téléphone
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#7C3AED]/10 dark:bg-[#8B5CF6]/15 text-[#7C3AED] dark:text-[#8B5CF6] border border-[#7C3AED]/20 dark:border-[#8B5CF6]/25">
                    QR Code &amp; PWA
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#8B92A0]">
                  Accessible sur iPhone, iPad et Android
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181F2A] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5 overflow-y-auto space-y-4 text-sm">
            {installSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto animate-bounce" />
                <h4 className="text-base font-bold text-emerald-400">Installation réussie !</h4>
                <p className="text-xs text-emerald-300">
                  Thunder Edge est maintenant disponible sur votre écran d'accueil comme une application native.
                </p>
              </div>
            ) : isInstalled ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="text-xs text-emerald-400">
                  <span className="font-bold block">Application déjà installée !</span>
                  Vous utilisez actuellement Thunder Edge en mode autonome plein écran.
                </div>
              </div>
            ) : null}

            {/* QR Code Section (Prominent) */}
            <div className="p-4 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 mb-2.5">
                <QrCode className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6]" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Scannez ce QR Code avec votre téléphone
                </span>
              </div>

              {/* QR Code Container */}
              <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700/60 inline-block mb-3">
                <QRCodeSVG
                  value={appUrl}
                  size={168}
                  level="H"
                  includeMargin={false}
                />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xs mb-3 font-medium">
                Pointez l'appareil photo de votre smartphone vers l'écran pour ouvrir Thunder Edge immédiatement.
              </p>

              {/* Copyable link */}
              <div className="w-full flex items-center gap-2 p-1.5 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430]">
                <span className="flex-1 truncate text-left px-2 font-mono text-[11px] text-[#6B7280] dark:text-[#8B92A0] select-all">
                  {appUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white font-semibold text-xs transition-colors cursor-pointer"
                  title="Copier le lien"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {/* If viewed directly on a mobile browser with native PWA prompt */}
            {isInstallable && (
              <div className="space-y-2">
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3.5 px-4 rounded-2xl bg-[#7C3AED] dark:bg-[#8B5CF6] hover:opacity-90 text-white font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>Ajouter à l&apos;écran d&apos;accueil maintenant</span>
                </button>
              </div>
            )}

            {/* Quick installation steps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* iPhone iOS */}
              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Smartphone className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#8B5CF6]" />
                  <span>Sur iPhone / iPad (Safari)</span>
                </div>
                <ol className="text-[11.5px] text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>
                    Ouvrez le lien dans <strong>Safari</strong>.
                  </li>
                  <li>
                    Touchez l'icône{' '}
                    <strong className="inline-flex items-center gap-0.5 text-[#7C3AED] dark:text-[#8B5CF6]">
                      <Share className="w-3 h-3 inline" /> Partager
                    </strong>.
                  </li>
                  <li>
                    Sélectionnez{' '}
                    <strong className="inline-flex items-center gap-0.5 text-[#7C3AED] dark:text-[#8B5CF6]">
                      <PlusSquare className="w-3 h-3 inline" /> Sur l'écran d'accueil
                    </strong>.
                  </li>
                </ol>
              </div>

              {/* Android Chrome */}
              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Sparkles className="w-3.5 h-3.5 text-[#7C3AED] dark:text-[#8B5CF6]" />
                  <span>Sur Android (Chrome)</span>
                </div>
                <ol className="text-[11.5px] text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>
                    Ouvrez le lien dans <strong>Chrome</strong>.
                  </li>
                  <li>
                    Touchez le menu <strong>⋮</strong> (en haut à droite).
                  </li>
                  <li>
                    Choisissez <strong>"Installer l'application"</strong> ou <strong>"Ajouter à l'écran d'accueil"</strong>.
                  </li>
                </ol>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] text-center space-y-0.5">
                <Zap className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] mx-auto" />
                <div className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">Lancement 0s</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">1-tap direct</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] text-center space-y-0.5">
                <WifiOff className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] mx-auto" />
                <div className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">Hors-ligne</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">Cache local Dexie</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#181F2A] border border-slate-200/60 dark:border-[#1C2430] text-center space-y-0.5">
                <ShieldCheck className="w-4 h-4 text-[#7C3AED] dark:text-[#8B5CF6] mx-auto" />
                <div className="text-[10.5px] font-bold text-slate-800 dark:text-slate-200">Cloud Sync</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-400">Temps réel Firebase</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200/60 dark:border-[#1C2430] bg-slate-50 dark:bg-[#131820] flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Vos trades seront automatiquement synchronisés
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold rounded-xl text-slate-700 dark:text-[#E6E8EB] hover:bg-slate-200 dark:hover:bg-[#1C2430] transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
