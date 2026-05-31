/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  createGameRoom, 
  joinGameRoom, 
  getActiveLobbies, 
  getUserProfile, 
  updateUserProfileName, 
  getLeaderboard 
} from '../firebase';
import { GameRoom, UserProfile } from '../types';
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
  Compass,
  Trophy,
  Award,
  Sparkles,
  Settings,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LobbyProps {
  userId: string;
  userName: string;
  onSelectGame: (roomId: string, mode: 'multiplayer' | 'singleplayer') => void;
  onLogout: () => void;
  onUpdateName?: (newName: string) => void;
}

export default function Lobby({ userId, userName, onSelectGame, onLogout, onUpdateName }: LobbyProps) {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Profile states
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [savingName, setSavingName] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Leaderboard states
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [activeTab, setActiveTab] = useState<'rooms' | 'leaderboard'>('rooms');

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

  const fetchProfile = async () => {
    try {
      const data = await getUserProfile(userId);
      if (data) {
        setProfile(data);
        setEditName(data.name);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchLeaderboardData = async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data || []);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchProfile();
    fetchLeaderboardData();

    // Auto-refresh lobbies every 15 seconds
    const interval = setInterval(fetchRooms, 15000);
    return () => clearInterval(interval);
  }, [userId, userName]);

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
    onSelectGame('LOCAL_BOT_' + Math.floor(Math.random() * 10000), 'singleplayer');
  };

  const handleUpdateNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError('Görünen isim en az 2 karakter olmalıdır.');
      return;
    }
    setSavingName(true);
    setSaveSuccess(false);
    try {
      await updateUserProfileName(userId, cleanName);
      setProfile(prev => prev ? { ...prev, name: cleanName } : null);
      if (onUpdateName) {
        onUpdateName(cleanName);
      }
      localStorage.setItem('mangala_nickname', cleanName);
      setSaveSuccess(true);
      // Reload leaderboard to show changed name to user
      fetchLeaderboardData();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Error updating profile name:', err);
      setError('Profil ismi güncellenemedi.');
    } finally {
      setSavingName(false);
    }
  };

  // Rank / Class structure
  const getRankInfo = (score: number) => {
    if (score >= 1000) return { name: "Mangala Bilgesi", color: "text-amber-400 border-amber-500/30 bg-amber-500/5", rankIcon: "🏆" };
    if (score >= 600) return { name: "Küli Haznedar", color: "text-purple-400 border-purple-500/30 bg-purple-500/5", rankIcon: "🔮" };
    if (score >= 300) return { name: "Kuyu Ustası", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/5", rankIcon: "⚔️" };
    if (score >= 100) return { name: "Stratejist", color: "text-blue-400 border-blue-500/30 bg-blue-500/5", rankIcon: "🎯" };
    return { name: "Acemi Oyuncu", color: "text-slate-400 border-slate-700 bg-slate-800/10", rankIcon: "🌱" };
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 md:py-12">
      {/* Top Welcome Bar with Stats */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row items-center justify-between bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-700 p-6 mb-8 gap-4 shadow-xl"
      >
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto text-center sm:text-left">
          <div 
            onClick={() => setShowProfileModal(true)}
            className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 text-amber-500 relative cursor-pointer hover:bg-amber-500/20 active:scale-95 transition"
            title="Profilimi Düzenle"
          >
            <User className="w-7 h-7" />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border border-slate-800 text-slate-950 shadow">
              <Settings className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
              Hoş Geldiniz, <span className="text-amber-400 font-extrabold">{userName}</span>
            </h2>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                ⭐ <span className="text-amber-400 font-bold">{profile?.score ?? 0}</span> Puan
              </span>
              <span className="text-slate-650">•</span>
              <span>
                Kazanma Oranı: <span className="text-indigo-400 font-semibold">{profile?.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0}%</span> (G {profile?.gamesWon ?? 0}/{profile?.gamesPlayed ?? 0})
              </span>
              <span className="text-slate-650">•</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRankInfo(profile?.score ?? 0).color}`}>
                <span>{getRankInfo(profile?.score ?? 0).rankIcon}</span>
                <span>{getRankInfo(profile?.score ?? 0).name}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-center sm:justify-end">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-750 hover:border-amber-500/40 text-slate-300 font-medium rounded-xl transition text-sm cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Profilim</span>
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-755 hover:border-amber-500/40 text-slate-300 font-medium rounded-xl transition text-sm cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Kurallar</span>
          </button>
          
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-red-100 border border-slate-750 hover:border-red-500/30 font-medium rounded-xl transition text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span className="hidden sm:inline">Çıkış</span>
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
              <span>Oyun Arenası</span>
            </h3>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 rounded-xl text-xs text-center relative">
                <span>{error}</span>
                <button className="absolute right-2 top-2" onClick={() => setError(null)}>
                  <X className="w-3.5 h-3.5" />
                </button>
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
                Oda Aç (Çevrimiçi)
              </span>
              <span className="bg-amber-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                Multiplayer
              </span>
            </button>

            {/* Start Single Player Against Bot */}
            <button
              onClick={handleStartSinglePlayer}
              disabled={loading}
              className="w-full flex items-center justify-between px-5 py-4 bg-slate-900 hover:bg-slate-850 border border-slate-750 text-white font-bold rounded-xl transition duration-255 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-200">
                <Cpu className="w-5 h-5 text-indigo-400" />
                Yapay Zekaya Karşı Oyna
              </span>
              <span className="bg-indigo-950 text-indigo-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                Solo Bot
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

        {/* Right column: Active Public Rooms & Global Leaderboard TABS */}
        <div className="md:col-span-7">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col h-full min-h-[380px]"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4 gap-2">
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-750">
                <button
                  onClick={() => setActiveTab('rooms')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'rooms' 
                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Aktif Lobiler</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('leaderboard');
                    fetchLeaderboardData();
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'leaderboard' 
                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>Skor Board</span>
                </button>
              </div>
              
              <button
                onClick={activeTab === 'rooms' ? fetchRooms : fetchLeaderboardData}
                disabled={activeTab === 'rooms' ? isRefreshing : loadingLeaderboard}
                className="p-1.5 px-3 bg-slate-900 hover:bg-slate-750 text-slate-350 rounded-lg transition active:scale-95 disabled:opacity-40 cursor-pointer text-xs font-semibold flex items-center gap-1"
                title="Yenile"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing || loadingLeaderboard ? 'animate-spin' : ''}`} />
                <span>Yenile</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
              {activeTab === 'rooms' ? (
                rooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 space-y-3">
                    <Tv className="w-12 h-12 stroke-1 text-slate-600 animate-pulse" />
                    <p className="text-sm font-medium">Şu an aktif oyun lobisi bulunmuyor.</p>
                    <p className="text-xs text-slate-600 text-center px-4 leading-relaxed">
                      Eşleşmek için sol kısımdan yeni bir oda açarak diğer oyuncuların katılması için ilk taşı atabilirsiniz!
                    </p>
                  </div>
                ) : (
                  rooms.map((room) => (
                    <motion.div 
                      key={room.id}
                      layoutId={`room-card-${room.id}`}
                      className="flex md:flex-row flex-col justify-between items-center bg-slate-900/40 hover:bg-slate-900 border border-slate-750 hover:border-slate-650 rounded-xl p-4 gap-3 transition"
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
                )
              ) : (
                /* Leaderboard global scores design */
                loadingLeaderboard ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                    <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                    <p className="text-xs">Küresel skor tahtası yükleniyor...</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                    <Trophy className="w-10 h-10 stroke-1" />
                    <p className="text-sm font-semibold">Skor tablosu boş.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.map((player, idx) => {
                      const rank = idx + 1;
                      const isSelf = player.uid === userId;
                      const rankStyle = 
                        rank === 1 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-black' :
                        rank === 2 ? 'bg-slate-350/15 border-slate-400/20 text-slate-300 font-bold' :
                        rank === 3 ? 'bg-orange-500/10 border-orange-550/20 text-orange-400 font-bold' :
                        'bg-slate-900 border-slate-800 text-slate-400';
                      
                      const rankDisplay = () => {
                        if (rank === 1) return "👑";
                        if (rank === 2) return "🥈";
                        if (rank === 3) return "🥉";
                        return rank;
                      };

                      const badgeIndex = getRankInfo(player.score);

                      return (
                        <div 
                          key={player.uid}
                          className={`flex items-center justify-between p-3 rounded-xl border transition ${
                            isSelf 
                              ? 'bg-amber-500/5 border-amber-500/40 shadow-inner ring-1 ring-amber-500/20' 
                              : 'bg-slate-900/45 border-slate-800 hover:border-slate-750'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Rank Badge */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs ${rankStyle}`}>
                              {rankDisplay()}
                            </div>
                            
                            <div>
                              <div className="text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                                <span className={isSelf ? 'text-amber-300 font-black' : ''}>
                                  {player.name}
                                </span>
                                {isSelf && (
                                  <span className="text-[9px] bg-amber-500/15 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                    SEN
                                  </span>
                                )}
                                {player.isAnonymous && !isSelf && (
                                  <span className="text-[8px] bg-slate-800 border border-slate-700 text-slate-400 px-1 py-0.2 rounded font-medium">
                                    Guest
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span className={`${badgeIndex.color} font-bold px-1.5 py-0.2 rounded border border-current scale-95 origin-left`}>
                                  {badgeIndex.name}
                                </span>
                                <span>•</span>
                                <span>Kazanma: {player.gamesWon ?? 0}/{player.gamesPlayed ?? 0}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-black text-lg text-amber-405">
                              {player.score}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 ml-1">Puan</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" />
                  Profil & Seviye Düzenle
                </h3>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Name Form */}
                <form onSubmit={handleUpdateNameSubmit} className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Görünen İsim (Yarı-Kalıcı)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={18}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Görünen isminiz..."
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm font-semibold"
                      disabled={savingName}
                    />
                    <button
                      type="submit"
                      disabled={savingName || !editName.trim() || editName.trim() === profile?.name}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold text-sm rounded-xl transition duration-250 active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      {savingName ? "Değiştiriliyor..." : "Güncelle"}
                    </button>
                  </div>
                  {saveSuccess && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="text-emerald-400 text-xs font-bold"
                    >
                      ✓ İsminiz başarıyla güncellendi!
                    </motion.p>
                  )}
                </form>

                {/* Rating Card */}
                <div className="bg-slate-900/60 rounded-2xl border border-slate-750 p-5 space-y-4">
                  <h4 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 border-b border-slate-750 pb-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    İstatistik ve Seviye
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Toplam Puan</p>
                      <p className="text-2xl font-black text-amber-400 mt-1">{profile?.score ?? 0} ⭐</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Klasman Seviyesi</p>
                      <span className={`inline-flex items-center text-[11px] font-black mt-2.5 bg-slate-950 px-2.5 py-1 rounded border overflow-ellipsis leading-4 truncate ${getRankInfo(profile?.score ?? 0).color}`}>
                        {getRankInfo(profile?.score ?? 0).rankIcon} {getRankInfo(profile?.score ?? 0).name}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg text-xs">
                      <p className="text-[9px] font-bold text-slate-500 uppercase">Maçlar</p>
                      <p className="font-bold text-slate-200 mt-0.5">{profile?.gamesPlayed ?? 0}</p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg text-xs">
                      <p className="text-[9px] font-bold text-emerald-500 uppercase">Galibiyet</p>
                      <p className="font-bold text-emerald-400 mt-0.5">{profile?.gamesWon ?? 0}</p>
                    </div>
                    <div className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg text-xs">
                      <p className="text-[9px] font-bold text-rose-500 uppercase">Kazanma</p>
                      <p className="font-bold text-rose-400 mt-0.5">
                        {profile?.gamesPlayed ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) : 0}%
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 border-t border-slate-750/70 pt-2.5 space-y-1">
                    <p className="font-semibold text-slate-450 text-center mb-1 bg-slate-900/30 py-0.5 rounded">Hedef Puan Klasmanları:</p>
                    <div className="flex justify-between"><span>🌱 Acemi Oyuncu</span> <span className="font-bold text-slate-500">0 - 99 Puan</span></div>
                    <div className="flex justify-between"><span>🎯 Stratejist</span> <span className="font-bold text-blue-400">100 - 299 Puan</span></div>
                    <div className="flex justify-between"><span>⚔️ Kuyu Ustası</span> <span className="font-bold text-indigo-400">300 - 550 Puan</span></div>
                    <div className="flex justify-between"><span>🔮 Küli Haznedar</span> <span className="font-bold text-purple-400">600 - 990 Puan</span></div>
                    <div className="flex justify-between"><span>🏆 Mangala Bilgesi</span> <span className="font-bold text-amber-400">1000+ Puan</span></div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 px-6 py-4 border-t border-slate-750 flex justify-end">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
