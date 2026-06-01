import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Star, CheckCircle, Flame, Palette } from 'lucide-react';
import { BOARDS, STONES } from '../constants';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface MarketViewProps {
  profile: UserProfile | null;
  onProfileUpdate: () => void;
}

export default function MarketView({ profile, onProfileUpdate }: MarketViewProps) {
  const [buying, setBuying] = useState<string | null>(null);
  
  if (!profile) return null;

  const currentCoins = profile.coins || 0;

  const handlePurchaseBoard = async (boardId: string, price: number) => {
    const unlockedBoards = profile.unlockedBoards || ['classic'];
    if (currentCoins < price || unlockedBoards.includes(boardId)) return;
    setBuying(boardId);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        coins: currentCoins - price,
        unlockedBoards: [...unlockedBoards, boardId],
        equippedBoard: boardId,
        updatedAt: serverTimestamp()
      });
      onProfileUpdate();
    } catch(err) {
      console.error(err);
    }
    setBuying(null);
  };

  const handlePurchaseStone = async (stoneId: string, price: number) => {
    const unlockedStones = profile.unlockedStones || ['classic'];
    if (currentCoins < price || unlockedStones.includes(stoneId)) return;
    setBuying(stoneId);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        coins: currentCoins - price,
        unlockedStones: [...unlockedStones, stoneId],
        equippedStone: stoneId,
        updatedAt: serverTimestamp()
      });
      onProfileUpdate();
    } catch(err) {
      console.error(err);
    }
    setBuying(null);
  };

  const handleEquipBoard = async (boardId: string) => {
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { equippedBoard: boardId });
      onProfileUpdate();
    } catch (err) { console.error(err); }
  };

  const handleEquipStone = async (stoneId: string) => {
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { equippedStone: stoneId });
      onProfileUpdate();
    } catch (err) { console.error(err); }
  };

  return (
    <motion.div 
      key="market-view"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-1 md:grid-cols-12 gap-8"
    >
      <div className="md:col-span-8 space-y-6">
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-indigo-400" />
              Özelleştirme Marketi
            </h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              <span className="text-lg font-bold text-white">{currentCoins} <span className="text-xs text-slate-400">Puan</span></span>
            </div>
          </div>

          <div className="space-y-8">
            <section>
              <h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                <Palette className="w-4 h-4 text-amber-500" /> Tahta Temaları
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.values(BOARDS).map((board: any) => {
                  const unlockedBoards = profile.unlockedBoards || ['classic'];
                  const isUnlocked = unlockedBoards.includes(board.id);
                  const isEquipped = profile.equippedBoard === board.id || (!profile.equippedBoard && board.id === 'classic');
                  
                  return (
                    <div key={board.id} className={`p-4 rounded-xl border flex flex-col gap-3 ${isEquipped ? 'bg-amber-500/10 border-amber-500/40 relative' : 'bg-slate-900/50 border-slate-700'}`}>
                      {isEquipped && <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-xl border-l border-b border-amber-600">SEÇİLİ</div>}
                      <div className={`h-12 rounded-lg border ${board.themeClass}`} />
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="font-bold text-slate-200">{board.name}</p>
                          {!isUnlocked && <span className="text-xs font-semibold text-yellow-500 flex items-center gap-1"><Star className="w-3 h-3" /> {board.price}</span>}
                        </div>
                        {isUnlocked ? (
                          <button 
                            disabled={isEquipped}
                            onClick={() => handleEquipBoard(board.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${isEquipped ? 'bg-amber-600 text-white cursor-default' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                          >
                            {isEquipped ? 'KULLANILIYOR' : 'KULLAN'}
                          </button>
                        ) : (
                          <button 
                            disabled={currentCoins < board.price || buying === board.id}
                            onClick={() => handlePurchaseBoard(board.id, board.price)}
                            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg transition"
                          >
                            {buying === board.id ? 'ALINIYOR...' : 'SATIN AL'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h4 className="text-slate-300 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                <div className="w-4 h-4 bg-gradient-to-br from-green-400 to-green-600 rounded-full" /> Taş Görünümleri
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.values(STONES).map((stone: any) => {
                  const unlockedStones = profile.unlockedStones || ['classic'];
                  const isUnlocked = unlockedStones.includes(stone.id);
                  const isEquipped = profile.equippedStone === stone.id || (!profile.equippedStone && stone.id === 'classic');
                  
                  return (
                    <div key={stone.id} className={`p-4 rounded-xl border flex flex-col gap-3 ${isEquipped ? 'bg-indigo-500/10 border-indigo-500/40 relative' : 'bg-slate-900/50 border-slate-700'}`}>
                      {isEquipped && <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-xl border-l border-b border-indigo-600">SEÇİLİ</div>}
                      <div className="flex items-center justify-center p-2 bg-slate-950 rounded-lg">
                        <div className="w-8 h-8 rounded-full" style={stone.style} />
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="font-bold text-slate-200">{stone.name}</p>
                          {!isUnlocked && <span className="text-xs font-semibold text-yellow-500 flex items-center gap-1"><Star className="w-3 h-3" /> {stone.price}</span>}
                        </div>
                        {isUnlocked ? (
                          <button 
                            disabled={isEquipped}
                            onClick={() => handleEquipStone(stone.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${isEquipped ? 'bg-indigo-600 text-white cursor-default' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                          >
                            {isEquipped ? 'KULLANILIYOR' : 'KULLAN'}
                          </button>
                        ) : (
                          <button 
                            disabled={currentCoins < stone.price || buying === stone.id}
                            onClick={() => handlePurchaseStone(stone.id, stone.price)}
                            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg transition"
                          >
                            {buying === stone.id ? 'ALINIYOR...' : 'SATIN AL'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="md:col-span-4">
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl h-full">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-4 mb-4">
            <Flame className="w-5 h-5 text-orange-500" />
            Günlük Görevler
          </h3>
          <div className="space-y-4">
            {profile.dailyQuests?.map(q => (
              <div key={q.id} className="bg-slate-900 border border-slate-750 p-4 rounded-xl flex flex-col gap-3 relative overflow-hidden">
                {q.completed && <div className="absolute inset-0 bg-emerald-900/20 z-0"></div>}
                <div className="flex justify-between gap-2 z-10">
                  <p className={`text-sm font-semibold ${q.completed ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {q.type === 'win_games' && `${q.target} Oyun Kazan`}
                    {q.type === 'play_games' && `${q.target} Oyun Oyna`}
                    {q.type === 'beat_hard_bot' && `Zor Botu ${q.target} Kez Yen`}
                    {q.type === 'double_move' && `Çifte Hamle Kuralını ${q.target} Kez Kullan`}
                  </p>
                  <span className="text-xs font-bold text-yellow-500 flex items-center gap-1 shrink-0"><Star className="w-3 h-3"/> {q.reward}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 z-10">
                  <div className={`h-2.5 rounded-full ${q.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }}></div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono text-right z-10">
                  {q.progress} / {q.target} {q.completed && '(Tamamlandı)'}
                </div>
              </div>
            ))}
            {(!profile.dailyQuests || profile.dailyQuests.length === 0) && (
              <p className="text-slate-500 text-sm text-center py-8">Görevler yükleniyor veya hazır değil...</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
