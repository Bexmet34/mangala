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
import MarketView from './MarketView';

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
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);

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
  const [currentView, setCurrentView] = useState<'play' | 'leaderboard' | 'market'>('play');
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

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

  const handleQuickPlay = async () => {
    setLoading(true);
    setError(null);
    try {
      const { findMatchmakingRoom } = await import('../firebase');
      const roomId = await findMatchmakingRoom();
      if (roomId) {
        await handleJoinRoom(roomId);
      } else {
        await handleCreateRoom();
      }
    } catch (err: any) {
      console.error(err);
      setError('Eşleştirme sırasında bir hata oluştu.');
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
    setShowDifficultyModal(true);
  };

  const selectDifficultyAndStart = (difficulty: 'easy' | 'medium' | 'hard' | 'unbeatable') => {
    localStorage.setItem('mangala_bot_difficulty', difficulty);
    setShowDifficultyModal(false);
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

      {/* View Selector Tabs */}
      <div className="flex bg-slate-900 border border-slate-750 p-1.5 rounded-2xl mb-8 select-none">
        <button
          onClick={() => setCurrentView('play')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
            currentView === 'play' 
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-md shadow-black/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Gamepad2 className="w-5 h-5 text-amber-500/80" />
          <span>Oyun Arenası & Odalar</span>
        </button>
        <button
          onClick={() => {
            setCurrentView('leaderboard');
            fetchLeaderboardData();
          }}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
            currentView === 'leaderboard' 
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-md shadow-black/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="hidden sm:inline">Skor Tahtası</span>
        </button>
        <button
          onClick={() => setCurrentView('market')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-extrabold transition cursor-pointer ${
            currentView === 'market' 
              ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shadow-md shadow-black/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          }`}
        >
          <span className="text-xl">🏪</span>
          <span className="hidden sm:inline">Market & Görevler</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {currentView === 'play' ? (
          <motion.div 
            key="play-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-8"
          >
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
                  <span>Tek & Çok Oyunculu Seçenekleri</span>
                </h3>

                {error && (
                  <div className="p-3 bg-red-950/40 border border-red-800 text-red-200 rounded-xl text-xs text-center relative">
                    <span>{error}</span>
                    <button className="absolute right-2 top-2" onClick={() => setError(null)}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Quick Play Matchmaking */}
                <button
                  onClick={handleQuickPlay}
                  disabled={loading}
                  className="w-full relative overflow-hidden group flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg transition duration-250 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2 relative z-10 text-lg">
                    <Gamepad2 className="w-6 h-6" />
                    Hemen Oyna (Rastgele Eşleşme)
                  </div>
                  <div className="absolute inset-0 w-full h-full bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-700"></div>
                  <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">VEYA</span>
                  <div className="h-px flex-1 bg-slate-700"></div>
                </div>

                {/* Create Room Button */}
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full flex items-center justify-between px-5 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition duration-250 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Yeni Oda Aç (Çevrimiçi)
                  </span>
                  <span className="bg-amber-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md">
                    Çevrimiçi
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

            {/* Right column: Active Public Rooms */}
            <div className="md:col-span-7">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800/80 rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-col h-full min-h-[380px]"
              >
                <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-4 gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-550" />
                    <span>Aktif Çevrimiçi Odalar</span>
                  </h3>
                  
                  <button
                    onClick={fetchRooms}
                    disabled={isRefreshing}
                    className="p-1.5 px-3 bg-slate-900 hover:bg-slate-750 text-slate-350 rounded-lg transition active:scale-95 disabled:opacity-40 cursor-pointer text-xs font-semibold flex items-center gap-1"
                    title="Yenile"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Yenile</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[380px]">
                  {rooms.length === 0 ? (
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
                          className="w-full md:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-550 text-white font-semibold text-xs rounded-lg shadow transition active:scale-95 cursor-pointer"
                        >
                          Katıl ve Oyna
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : currentView === 'leaderboard' ? (
          /* Separate / Dedicated Glorious Skorboard View */
          <motion.div 
            key="leaderboard-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full bg-slate-800/80 rounded-2xl border border-slate-700 p-6 md:p-8 shadow-xl space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-5">
              <div className="space-y-1 text-center sm:text-left">
                <h3 className="text-xl md:text-2xl font-black text-white flex items-center justify-center sm:justify-start gap-2.5">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  <span>Küresel Liderlik Sıralaması (Skorboard)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Oyunda minimum 1 puan kazanmış tüm kayıtlı oyuncular burada gösterilir (0 puan sahipleri gizlenmiştir).
                </p>
              </div>
              <button
                onClick={fetchLeaderboardData}
                disabled={loadingLeaderboard}
                className="self-center sm:self-auto px-4.5 py-2.5 bg-slate-900 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:border-amber-500/30 rounded-xl transition font-semibold text-xs flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
                {loadingLeaderboard ? 'Güncelleniyor...' : 'Verileri Yenile'}
              </button>
            </div>

            {/* Search and stats bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Search */}
              <div className="md:col-span-6 relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Oyuncu adı ile listede ara..."
                  value={leaderboardSearch}
                  onChange={(e) => setLeaderboardSearch(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                {leaderboardSearch && (
                  <button 
                    onClick={() => setLeaderboardSearch('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Badges/Stats info */}
              <div className="md:col-span-6 flex flex-wrap gap-2 items-center justify-center md:justify-end text-[11px] text-slate-400">
                <span className="px-3 py-1.5 bg-slate-900/60 border border-slate-750 rounded-xl flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Kayıtlı Oyuncu: <strong className="text-amber-400 ml-0.5">{leaderboard.length}</strong>
                </span>
                {leaderboardSearch && (
                  <span className="px-3 py-1.5 bg-slate-900/60 border border-slate-750 rounded-xl flex items-center gap-1.5">
                    Filtrelenen: <strong className="text-white ml-0.5">
                      {leaderboard.filter(player => player.name.toLowerCase().includes(leaderboardSearch.toLowerCase())).length}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* List Table container */}
            <div className="overflow-x-auto rounded-xl border border-slate-750 bg-slate-900/20">
              {loadingLeaderboard ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                  <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                  <p className="text-xs text-slate-400">Veritabanından tüm oyuncular çekiliyor...</p>
                </div>
              ) : (
                (() => {
                  const filteredList = leaderboard.filter(player => {
                    if (!leaderboardSearch.trim()) return true;
                    return player.name.toLowerCase().includes(leaderboardSearch.toLowerCase());
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3 text-center px-4">
                        <Trophy className="w-12 h-12 stroke-1 text-slate-600" />
                        <p className="text-sm font-semibold text-slate-400">Aranan Oyuncu Bulunamadı!</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          {leaderboardSearch ? 'Girdiğiniz filtreye uygun bir kayıt bulunmuyor.' : 'Oynayıp en az 1 puan kazanmış hiç kayıtlı üye bulunamadı.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <table className="w-full text-left whitespace-nowrap text-xs md:text-sm">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-750 text-slate-400 font-bold text-[11px] uppercase tracking-wider select-none">
                          <th className="py-3 px-4 text-center w-16">Derece</th>
                          <th className="py-3 px-4">Oyuncu Bilgisi</th>
                          <th className="py-3 px-4 text-center">Rütbe</th>
                          <th className="py-3 px-4 text-center">Toplam Maç</th>
                          <th className="py-3 px-4 text-center">Galibiyet / Yenilgi</th>
                          <th className="py-3 px-4 text-center">Kazanma Oranı</th>
                          <th className="py-3 px-4 text-right pr-6">Toplam Puan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredList.map((player, index) => {
                          const isCurrentUser = player.uid === userId;
                          const rank = index + 1;
                          const winRate = player.gamesPlayed ? Math.round((player.gamesWon / player.gamesPlayed) * 100) : 0;
                          const rankInfo = getRankInfo(player.score);
                          
                          // Distinctive badges for top 3
                          let rankBadge: React.ReactNode = <span>{rank}.</span>;
                          if (rank === 1) rankBadge = <span className="text-xl">🥇</span>;
                          else if (rank === 2) rankBadge = <span className="text-xl">🥈</span>;
                          else if (rank === 3) rankBadge = <span className="text-xl">🥉</span>;

                          return (
                            <tr 
                              key={player.uid} 
                              className={`transition duration-150 ${
                                isCurrentUser 
                                  ? 'bg-amber-500/10 hover:bg-amber-500/15 font-semibold' 
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3.5 px-4 text-center font-bold">
                                {rankBadge}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs select-none ${
                                    isCurrentUser 
                                      ? 'bg-amber-500 text-slate-950' 
                                      : player.isAnonymous 
                                        ? 'bg-slate-800 text-slate-400 border border-slate-700' 
                                        : 'bg-indigo-600 text-white'
                                  }`}>
                                    {player.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-xs md:text-sm ${isCurrentUser ? 'text-amber-400 font-extrabold' : 'text-slate-200 font-medium'}`}>
                                        {player.name}
                                      </span>
                                      {isCurrentUser && (
                                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-black uppercase tracking-widest animate-pulse">
                                          Sen
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono block">ID: ...{player.uid.slice(-6)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-center select-none">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${rankInfo.color}`}>
                                  <span>{rankInfo.rankIcon}</span>
                                  <span>{rankInfo.name}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center font-medium text-slate-300">
                                {player.gamesPlayed ?? 0}
                              </td>
                              <td className="py-3.5 px-4 text-center text-xs">
                                <span className="text-emerald-400 font-semibold">{player.gamesWon ?? 0}G</span>
                                <span className="mx-1 text-slate-600">/</span>
                                <span className="text-rose-450 font-semibold">{(player.gamesPlayed ?? 0) - (player.gamesWon ?? 0)}M</span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-12 bg-slate-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                                    <div 
                                      className="h-1.5 rounded-full" 
                                      style={{ 
                                        width: `${winRate}%`, 
                                        backgroundColor: winRate >= 50 ? '#10b981' : '#f43f5e' 
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-bold font-mono text-slate-350">{winRate}%</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right pr-6">
                                <span className="text-xs md:text-sm font-extrabold text-amber-400 font-mono">
                                  ⭐ {player.score}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()
              )}
            </div>
          </motion.div>
        ) : currentView === 'market' ? (
          <MarketView profile={profile} onProfileUpdate={fetchProfile} />
        ) : null}
      </AnimatePresence>

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

        {/* AI Difficulty Selection Modal */}
        {showDifficultyModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl text-left"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  Yapay Zeka Seviyesi Seçin
                </h3>
                <button
                  onClick={() => setShowDifficultyModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-400">
                  Mangala stratejinizi test etmek ve puan kazanmak için bir zorluk seviyesi seçin. <strong>Zor+</strong> seviyesinde bot yenilmez bir strateji uygular!
                </p>

                <div className="space-y-2.5">
                  {/* Easy */}
                  <button
                    onClick={() => selectDifficultyAndStart('easy')}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-700 hover:border-emerald-500/40 bg-slate-900/40 hover:bg-slate-900/80 transition flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                      🌱
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition flex items-center gap-2">
                        <span>Basit (Kolay)</span>
                        <span className="text-[9px] bg-emerald-555/15 border border-emerald-500/25 px-1.5 py-0.2 rounded text-emerald-400 uppercase font-black tracking-wider">Acemi</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Yapay zeka ara sıra hata yapar ve kolay hamleler oynar. Yeni öğrenenler için idealdir.
                      </p>
                    </div>
                  </button>

                  {/* Medium */}
                  <button
                    onClick={() => selectDifficultyAndStart('medium')}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-700 hover:border-blue-500/40 bg-slate-900/40 hover:bg-slate-900/80 transition flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                      🎯
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-blue-400 transition flex items-center gap-2">
                        <span>Normal (Orta)</span>
                        <span className="text-[9px] bg-blue-555/15 border border-blue-500/25 px-1.5 py-0.2 rounded text-blue-400 uppercase font-black tracking-wider">Stratejist</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Dengeli oyun tarzı. Basit tuzakları sezer ve standart hamle hesaplamaları yapar.
                      </p>
                    </div>
                  </button>

                  {/* Hard */}
                  <button
                    onClick={() => selectDifficultyAndStart('hard')}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-700 hover:border-purple-500/40 bg-slate-900/40 hover:bg-slate-900/80 transition flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                      ⚔️
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-purple-400 transition flex items-center gap-2">
                        <span>Zor (Usta)</span>
                        <span className="text-[9px] bg-purple-555/15 border border-purple-500/25 px-1.5 py-0.2 rounded text-purple-400 uppercase font-black tracking-wider">Hükümdar</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        5 hamle sonrasını hesaplayarak oynamayı sever. Sizi açmaza sokacak taktikler uygulayabilir!
                      </p>
                    </div>
                  </button>

                  {/* Unbeatable / Zor+ */}
                  <button
                    onClick={() => selectDifficultyAndStart('unbeatable')}
                    className="w-full text-left p-3.5 rounded-xl border border-amber-500/30 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 transition flex items-start gap-3 group"
                  >
                    <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 animate-pulse">
                      👑
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-amber-400 transition flex items-center gap-2">
                        <span>Zor+ (Yenilmez Yapay Zeka)</span>
                        <span className="text-[9px] bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 rounded text-amber-400 uppercase font-black tracking-wider animate-bounce">RAKİPSİZ</span>
                      </div>
                      <p className="text-xs text-amber-300/80 mt-0.5 font-medium">
                        9 katman derinliğinde arama yapan, kusursuz hedeflere sahip ve yenilmesi neredeyse imkansız olan üstün yapay zeka!
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 px-6 py-4 border-t border-slate-700 flex justify-end">
                <button
                  onClick={() => setShowDifficultyModal(false)}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition cursor-pointer"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
