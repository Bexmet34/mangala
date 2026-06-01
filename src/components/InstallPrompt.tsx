import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Only show once per session or day based on localStorage, but for testing we show if not dismissed
    const dismissed = localStorage.getItem('mangala_pwa_dismissed');
    if (dismissed) return;

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

    if (isStandalone) {
      return; 
    }

    if (isIOS) setPlatform('ios');
    else if (isAndroid) setPlatform('android');

    // Android PWA prompt catcher
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!dismissed) setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show manual prompt for iOS since they don't support beforeinstallprompt natively
    if (isIOS) {
      setShowPrompt(true);
    } // Wait a bit for android 'beforeinstallprompt' to fire

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
        localStorage.setItem('mangala_pwa_dismissed', 'true');
      }
      setDeferredPrompt(null);
    } else if (platform === 'ios') {
      // Just keep it open to show the instructions
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('mangala_pwa_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        className="fixed top-2 md:top-4 left-2 right-2 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md z-50 bg-slate-800 border-2 border-indigo-500/50 shadow-2xl rounded-2xl p-4 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-amber-600 to-indigo-600"></div>
        <button 
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-700 transition"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex gap-4 items-start pr-6">
          <div className="w-12 h-12 flex-shrink-0 bg-slate-900 rounded-xl flex items-center justify-center shadow-inner border border-slate-700">
            <Download className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm">Uygulamayı Ana Ekrana Ekle</h3>
            <p className="text-slate-300 text-xs mt-1 leading-relaxed">
              Daha hızlı erişim, daha iyi performans ve tam ekran deneyimi için Mangala'yı telefonunuza yükleyin.
            </p>
            
            <div className="mt-3">
              {platform === 'ios' ? (
                <div className="bg-slate-900/50 p-2 rounded-lg text-xs text-slate-300 flex items-center gap-2 border border-slate-700">
                  <Share className="w-4 h-4 text-slate-400" />
                  <span>Önce <strong>Paylaş</strong> simgesine, ardından<br/><strong>Ana Ekrana Ekle</strong>'ye dokunun.</span>
                </div>
              ) : (
                <button 
                  onClick={handleInstallClick}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition shadow-lg shadow-indigo-900/50"
                >
                  Hemen Yükle
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
