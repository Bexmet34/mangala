/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createGameRoom, joinGameRoom, getActiveLobbies } from '../firebase';
import { GameRoom } from '../types';
import { 
  Plus, 
  Search, 
  Tv, 
  Cpu, 
  RefreshCw, 
  User, 
  LogOut, 
  Gamepad2, 
  BookOpen, 
  X,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LobbyProps {
  userId: string;
  userName: string;
  onSelectGame: (roomId: string, mode: 'multiplayer' | 'singleplayer') => void;
  onLogout: () => void;
}

export default function Lobby({ userId, userName, onSelectGame, onLogout }: LobbyProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const fetchRooms = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const activeRooms = await getActiveLobbies() || [];
      const now = Date.now();
      // Filter out completed/abandoned or stale lobbies (older than 30 minutes)
      const freshRooms = activeRooms.filter(r => {
        if (r.status !== 'lobby') return false;
        if (r.updatedAt) {
          const updateTime = r.updatedAt.seconds ? r.updatedAt.seconds * 1000 : new Date(r.updatedAt).getTime();
          if (now - updateTime > 30 * 60 * 1000) return false; // Filter stale rooms
        }
        return true;
      });
      setRooms(freshRooms);
    } catch (err: any) {
      console.error(err);
      setError('Odalar yüklenirken bir hata oluştu.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchRooms, 15000);
    return () => clearInterval(interval);
  }, []);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing O/0, I/1
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError(null);
    const code = generateRoomCode();
    try {
      await createGameRoom(code, userName);
      onSelectGame(code, 'multiplayer');
    } catch (err: any) {
      console.error(err);
      setError('Oyun odası oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (codeToJoin?: string) => {
    const code = (codeToJoin || roomCodeInput).trim().toUpperCase();
    if (!code) {
      setError('Lütfen geçerli bir oda kodu girin.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await joinGameRoom(code, userName);
      onSelectGame(code, 'multiplayer');
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Odaya katılım başarısız oldu.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed && typeof parsed === 'object' && parsed.error) {
            errMsg = parsed.error;
          } else {
            errMsg = err.message;
          }
        } catch {
          errMsg = err.message;
        }
      } else if (typeof err === 'string') {
        errMsg = err;
      }

      if (errMsg.includes('bulunamadı')) {
        setError('Girdiğiniz kodla eşleşen aktif bir oyun odası bulunamadı!');
      } else if (errMsg.includes('dolu')) {
        setError('Bu oyun odası dolu!');
      } else {
        setError(errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartSinglePlayer = () => {
    // Start locally playing with bot
    onSelectGame('LOCAL_BOT_' + Math.floor(Math.random()*10000), 'singleplayer');
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 md:py-12">
      {/* Top Welcome Bar */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center justify-between bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-700 p-6 mb-8 gap-4 shadow-xl"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 text-amber-500">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Hoş Geldiniz, <span className="text-amber-400 font-extrabold">{userName}</span>
            </h2>
            <p className="text-slate-400 text-xs">
              Mangala arenasında rakiplerinizi bekliyor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-700 hover:border-amber-500/40 text-slate-300 font-medium rounded-xl transition text-sm cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span>Kurallar</span>
          </button>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-red-400 border border-slate-700 hover:border-red-500/30 font-medium rounded-xl transition text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Çıkış</span>
          </button>
        </div>
      </motion.div>

      {/* Main Grid Options */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left column: Quick Actions */}
        <div className="md:col-span-5 space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl space-y-5"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-3">
              <Gamepad2 className="w-5 h-5 text-amber-500" />
              <span>Hızlı Aksiyonlar</span>
            </h3>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 rounded-xl text-xs text-center">
                {error}
              </div>
            )}

            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full flex items-center justify-between px-5 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition duration-250 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Yeni Çevrimiçi Oda Aç
              </span>
              <span className="bg-amber-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                Multiplayer
              </span>
            </button>

            {/* Start Single Player Against Bot */}
            <button
              onClick={handleStartSinglePlayer}
              disabled={loading}
              className="w-full flex items-center justify-between px-5 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold rounded-xl transition duration-250 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-200">
                <Cpu className="w-5 h-5 text-indigo-400" />
                Yapay Zekaya Karşı Oyna
              </span>
              <span className="bg-indigo-950 text-indigo-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                Bot / Solo
              </span>
            </button>

            {/* Join Room by Room Code */}
            <div className="pt-2 border-t border-slate-700/60">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Kod ile Odaya Katıl
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={5}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value)}
                  placeholder="ODA KODU"
                  className="w-full uppercase text-center font-mono font-bold text-lg tracking-widest px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  disabled={loading}
                />
                <button
                  onClick={() => handleJoinRoom()}
                  disabled={loading || !roomCodeInput}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white font-medium rounded-xl transition active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right column: Active Public Rooms */}
        <div className="md:col-span-7">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col h-full min-h-[350px]"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-amber-500" />
                <span>Aktif Oyun Lobileri</span>
              </h3>
              
              <button
                onClick={fetchRooms}
                disabled={isRefreshing}
                className="p-2 bg-slate-900 hover:bg-slate-700 text-slate-300 rounded-xl transition active:scale-95 disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[350px]">
              {rooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
                  <Tv className="w-12 h-12 stroke-1" />
                  <p className="text-sm">Şu an aktif oyun lobisi bulunmuyor.</p>
                  <p className="text-xs text-slate-600 text-center px-4">
                    Sol kısımdan yeni bir oda açarak diğer oyuncuların katılması için ilk adımı atabilirsiniz!
                  </p>
                </div>
              ) : (
                rooms.map((room) => (
                  <motion.div 
                    key={room.id}
                    layoutId={`room-card-${room.id}`}
                    className="flex md:flex-row flex-col justify-between items-center bg-slate-900/60 hover:bg-slate-900 border border-slate-750 hover:border-slate-600 rounded-xl p-4 gap-3 transition"
                  >
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-lg font-mono font-bold tracking-wider text-sm">
                        {room.id}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          {room.player1Name}'in Odası
                        </div>
                        <div className="text-xs text-slate-400">
                          Durum: Bekliyor (1/2 Katılımcı)
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom(room.id)}
                      className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg shadow transition active:scale-95 cursor-pointer"
                    >
                      Katıl ve Oyna
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRulesModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-amber-500" />
                  Mangala Oyunu Kuralları
                </h3>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-slate-300 text-sm leading-relaxed">
                <section>
                  <h4 className="text-amber-400 font-bold mb-1.5 text-base">1. Genel Kurulum</h4>
                  <p>
                    Mangala oyunu 12 adet küçük kuyu (her oyuncunun önünde 6 kuyu bulunur) ve 2 adet büyük hazne (hazine kalesi) ile oynanır. Oyuna başlarken her kuyuya <strong>4 adet taş</strong> koyulur (Toplam 48 taş). Sağ taraftaki hazne oyuncunun kendi haznesidir.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1.5 text-base">2. Taş Dağıtma & Sıra Kuralları</h4>
                  <p>
                    Kendi tarafınızdaki dolu bir kuyuyu seçip tüm taşları alırsınız. Bu taşların <strong>1 tanesini seçtiğiniz kuyuya bırakıp</strong> kalanları saat yönünün tersine (sağa doğru) birer birer dağıtırsınız. 
                  </p>
                  <p className="mt-1.5 text-slate-400 italic">
                    İstisna: Eğer kuyuda tek taş varsa, o taş bir sonraki kuyuya taşınır (kuyu boş kalır).
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1.5 text-base">3. Hazneye Gelme Kuralı (Ekstra Hamle)</h4>
                  <p>
                    Eğer dağıttığınız son taş <strong>kendi haznenize</strong> denk gelirse, oyun sırası size kalır ve <strong>bir hamle daha</strong> yapma hakkı elde edersiniz.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1.5 text-base">4. Çift Kuralı (Taş Kazanma)</h4>
                  <p>
                    Sıra sizdeyken son taş rakibin kuyularından birine düşer ve oradaki taş sayısını <strong>çift sayıya</strong> ulaştırırsa (2, 4, 6, 8, vb.), o kuyudaki tüm taşları kazanır ve kendi haznenize koyarsınız.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1.5 text-base">5. Boş Kuyu Kuralı ("Öksüz" Kuralı)</h4>
                  <p>
                    Son taş kendi tarafınızdaki <strong>boş bir kuyuya</strong> düşerse ve o kuyunun tam karşısındaki rakip kuyuda taş varsa; hem koyduğunuz o 1 taşı hem de karşı kuyudaki tüm taşları kazanarak haznenize alırsınız.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1.5 text-base">6. Oyun Sonu & Kazanan</h4>
                  <p>
                    Bir tarafın 6 kuyusundaki taşlar tamamen bittiğinde oyun sona erer. Taşlarını ilk bitiren oyuncu, <strong>rakibin kalan tüm taşlarını da kazanır</strong>. Haznesinde en çok taşı (25 veya üzeri) toplayan oyunu kazanır. Durum 24-24 ise berabere biter.
                  </p>
                </section>
              </div>

              <div className="bg-slate-900 px-6 py-4 border-t border-slate-700 flex justify-end">
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Anladım, Başlayalım!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
