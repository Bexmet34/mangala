/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { loginWithGoogle, loginAnonymously } from '../firebase';
import { CircleDot, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthScreenProps {
  onAuthSuccess: (uid: string, name: string, isAnonymous: boolean) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Initialize nickname from localStorage if available
  useEffect(() => {
    const savedName = localStorage.getItem('mangala_nickname');
    if (savedName) {
      setNickname(savedName);
    }
  }, []);

  const handleSignIn = async (method: 'google' | 'anonymous') => {
    const finalName = nickname.trim() || `Oyuncu_${Math.floor(1000 + Math.random() * 9000)}`;
    setError(null);
    setLoading(true);

    try {
      localStorage.setItem('mangala_nickname', finalName);
      let user;
      if (method === 'google') {
        user = await loginWithGoogle();
      } else {
        user = await loginAnonymously();
      }

      if (user) {
        onAuthSuccess(
          user.uid, 
          user.displayName || finalName, 
          user.isAnonymous
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err.code === 'auth/popup-blocked'
          ? 'Giriş penceresi engellendi. Lütfen pop-up izinlerini kontrol edin.'
          : 'Giriş yapılırken hata oluştu. Lütfen tekrar deneyin.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md bg-slate-800/85 backdrop-blur-md rounded-2xl border border-slate-700 p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700" />
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 border border-slate-700 mb-4 text-amber-500 shadow-inner">
            <CircleDot className="w-8 h-8 animate-pulse text-amber-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-wider">
            MANGALA <span className="text-amber-500">ONLINE</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Türk Zeka ve Strateji Oyunu • Çevrimiçi Multiplayer
          </p>
          <div className="mt-2.5 inline-block px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold tracking-wider animate-pulse">
            FatoşH2o için
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Takma Adınız (Nickname)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User className="w-5 h-5 text-slate-400" />
              </span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={18}
                placeholder="Örn: Alparslan_24"
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-base"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Boş bırakırsanız rastgele bir isim verilecektir.
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-red-950/50 border border-red-800 text-red-200 rounded-xl text-sm text-center"
            >
              {error}
            </motion.div>
          )}

          {/* Action buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleSignIn('anonymous')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <span>{loading ? 'Yükleniyor...' : 'Misafir Girişi (Hızlı)'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSignIn('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl border border-slate-700 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Bağlanıyor...' : 'Google ile Güvenli Giriş'}</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-amber-600/70" />
          <span>Verileriniz güvenle Firestore üzerinde senkronize edilir.</span>
        </div>
      </motion.div>
    </div>
  );
}
