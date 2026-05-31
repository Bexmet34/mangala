/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, logoutUser, testConnection } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthScreen from './components/AuthScreen';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import { CircleDot, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<{ uid: string; name: string; isAnonymous: boolean } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'singleplayer' | null>(null);

  // Authenticate state listener
  useEffect(() => {
    // Validate connection
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // Fallback to name from localStorage if anonymous login or displayName not set
        const localName = localStorage.getItem('mangala_nickname');
        const defaultName = `Oyuncu_${currentUser.uid.substring(0, 4)}`;
        setUser({
          uid: currentUser.uid,
          name: currentUser.displayName || localName || defaultName,
          isAnonymous: currentUser.isAnonymous
        });
      } else {
        setUser(null);
      }
      setLoadingUser(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (uid: string, name: string, isAnonymous: boolean) => {
    setUser({ uid, name, isAnonymous });
  };

  const handleSelectGame = (roomId: string, mode: 'multiplayer' | 'singleplayer') => {
    setActiveRoomId(roomId);
    setGameMode(mode);
  };

  const handleBackToLobby = () => {
    setActiveRoomId(null);
    setGameMode(null);
  };

  const handleLogout = async () => {
    setLoadingUser(true);
    try {
      await logoutUser();
      localStorage.removeItem('mangala_nickname');
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans flex flex-col justify-between">
      {/* Dynamic Header */}
      <header className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleBackToLobby}>
            <CircleDot className="w-6 h-6 text-amber-500 animate-pulse" />
            <h1 className="text-xl font-black text-white tracking-wider">
              MANGALA<span className="text-amber-500 font-medium text-sm ml-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">ONLINE</span>
            </h1>
          </div>
          <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wide hidden sm:block">
            Zeka • Strateji • Kültür
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center py-6 w-full max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {loadingUser ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <RefreshCw className="w-12 h-12 text-amber-500 animate-spin" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Bağantı senkronize ediliyor...</p>
            </motion.div>
          ) : !user ? (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <AuthScreen onAuthSuccess={handleAuthSuccess} />
            </motion.div>
          ) : !activeRoomId ? (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <Lobby 
                userId={user.uid} 
                userName={user.name} 
                onSelectGame={handleSelectGame} 
                onLogout={handleLogout}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="game"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25 }}
              className="w-full"
            >
              <GameBoard 
                roomId={activeRoomId} 
                gameMode={gameMode!} 
                currUserId={user.uid} 
                currUserName={user.name} 
                onBackToLobby={handleBackToLobby}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 Mangala Online. Geleneksel Türk Zeka Oyunu.</p>
          <p className="flex items-center gap-1">
            <span>Powered by</span>
            <span className="text-amber-500/80 font-bold font-mono">Hakkı Başakın</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
