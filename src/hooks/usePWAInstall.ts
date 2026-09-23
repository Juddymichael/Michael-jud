import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed as PWA or running from home screen)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // Detect mobile device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/.test(userAgent));
    const isMobileDevice = isIOSDevice || /android|webos|blackberry|iemobile|opera mini/i.test(userAgent);

    setIsIOS(isIOSDevice);
    setIsMobile(isMobileDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.error('Error during PWA installation:', err);
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isMobile,
    install,
    deferredPrompt,
  };
}
