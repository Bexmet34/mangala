/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, logoutUser, testConnection, getUserProfile, createUserProfile, updateUserProfileName } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AuthScreen from './components/AuthScreen';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import InstallPrompt from './components/InstallPrompt';
import { CircleDot, RefreshCw, BookOpen, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<{ uid: string; name: string; isAnonymous: boolean } | null>(null);
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<'multiplayer' | 'singleplayer' | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Authenticate state listener
  useEffect(() => {
    // Validate connection
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const localName = localStorage.getItem('mangala_nickname');
          const defaultName = currentUser.displayName || localName || `Oyuncu_${currentUser.uid.substring(0, 4)}`;
          
          let profile = await getUserProfile(currentUser.uid);
          if (!profile) {
            profile = await createUserProfile(currentUser.uid, defaultName, currentUser.isAnonymous);
          }
          
          setFullProfile(profile);
          localStorage.setItem('mangala_nickname', profile.name);
          setUser({
            uid: currentUser.uid,
            name: profile.name,
            isAnonymous: currentUser.isAnonymous
          });
        } catch (e: any) {
          console.error("Profile sync error, falling back locally:", e);
          const localName = localStorage.getItem('mangala_nickname');
          const defaultName = `Oyuncu_${currentUser.uid.substring(0, 4)}`;
          setUser({
            uid: currentUser.uid,
            name: currentUser.displayName || localName || defaultName,
            isAnonymous: currentUser.isAnonymous
          });
        }
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
      <InstallPrompt />
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
                onUpdateName={(newName: string) => setUser(prev => prev ? { ...prev, name: newName } : null)}
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
                initialUserProfile={fullProfile}
                onBackToLobby={handleBackToLobby}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* SEO Optimized Section & Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 pt-10 pb-8 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* SEO descriptive text designed for crawlers and humans alike */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-900 text-left">
            <div className="space-y-2.5">
              <h4 className="text-white font-bold text-sm tracking-wide uppercase">Mangala Nedir?</h4>
              <p className="text-slate-500 leading-relaxed">
                Mangala, kökeni asırlara dayanan geleneksel bir Türk zeka ve strateji oyunudur. İki kişi tarafından 12 kuyu ve 48 taş ile oynanan bu kadim oyun; stratejik planlama, taktiğe dayalı karar alma ve matematiksel öngörü becerilerini en üst seviyeye taşır.
              </p>
            </div>
            <div className="space-y-2.5">
              <h4 className="text-white font-bold text-sm tracking-wide uppercase">Çevrimiçi & Yapay Zeka Arenası</h4>
              <p className="text-slate-500 leading-relaxed">
                Sitemiz, Mangala kültürünü modern dünyayla buluşturur. Arkadaşlarınızla gerçek zamanlı çok oyunculu mücadelelere katılabilir veya Basit seviyeden başlayıp <strong>Zor+ (Unbeatable)</strong> seviyesine ulaşan rakipsiz yapay zekaya karşı zekanızı test edebilirsiniz.
              </p>
            </div>
            <div className="space-y-2.5">
              <h4 className="text-white font-bold text-sm tracking-wide uppercase">SEO & Keşfedilebilirlik</h4>
              <p className="text-slate-500 leading-relaxed">
                Türk kültür mirası olan Mangala oyununun Google, Yandex ve Bing gibi arama motorlarında tam uyumlulukla indekslenmesi için geliştirilmiştir. Online Mangala oyna, seviye atla ve küresel skor tablosunda en iyiler arasına gir!
              </p>
            </div>
          </div>

          {/* Sub menu and copyright */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 gap-4 text-center sm:text-left">
            <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 font-medium">
              <button 
                onClick={() => setShowRulesModal(true)}
                className="text-slate-500 hover:text-amber-500 transition cursor-pointer flex items-center gap-1 text-[13px]"
              >
                <BookOpen className="w-4 h-4 text-amber-500/80" />
                <span>Oyun Kuralları</span>
              </button>
              <button 
                onClick={() => setShowAboutModal(true)}
                className="text-slate-500 hover:text-amber-500 transition cursor-pointer flex items-center gap-1 text-[13px]"
              >
                <Info className="w-4 h-4 text-amber-500/80" />
                <span>Hakkımızda</span>
              </button>
            </div>

            <div className="text-slate-500 flex flex-col sm:items-end gap-1.5">
              <p>© 2026 Online Mangala. Tüm hakları saklıdır. Geleneksel Türk Zeka Oyunu Portalı.</p>
              <p className="flex items-center justify-center sm:justify-end gap-1 text-[11px]">
                <span>Tasarım & Algoritmalar:</span>
                <span className="text-amber-500 font-bold">Hakkı Başakın</span>
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Modals */}
      <AnimatePresence>
        {/* Rules Modal */}
        {showRulesModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl text-left"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
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
                  <h4 className="text-amber-400 font-bold mb-1">1. Genel Kurulum</h4>
                  <p>
                    Mangala oyunu 12 adet küçük kuyu (her oyuncunun önünde 6 kuyu bulunur) ve 2 adet büyük hazne (hazine kalesi) ile oynanır. Oyuna başlarken her kuyuya <strong>4 adet taş</strong> koyulur (Toplam 48 taş). Sağ taraftaki hazne oyuncunun kendi haznesidir.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1">2. Taş Dağıtma & Sıra Kuralları</h4>
                  <p>
                    Kendi tarafınızdaki dolu bir kuyuyu seçip tüm taşları alırsınız. Bu taşların <strong>1 tanesini seçtiğiniz kuyuya bırakıp</strong> kalanları saat yönünün tersine (sağa doğru) birer birer dağıtırsınız. 
                  </p>
                  <p className="mt-1 text-slate-400 italic">
                    İstisna: Eğer kuyuda tek taş varsa, o taş bir sonraki kuyuya taşınır (kuyu boş kalır).
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1">3. Hazneye Gelme Kuralı (Ekstra Hamle)</h4>
                  <p>
                    Eğer dağıttığınız son taş <strong>kendi haznenize</strong> denk gelirse, oyun sırası size kalır ve <strong>bir hamle daha</strong> yapma hakkı elde edersiniz.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1">4. Çift Kuralı (Taş Kazanma)</h4>
                  <p>
                    Sıra sizdeyken son taş rakibin kuyularından birine düşer ve oradaki taş sayısını <strong>çift sayıya</strong> ulaştırırsa (2, 4, 6, 8, vb.), o kuyudaki tüm taşları kazanır ve kendi haznenize koyarsınız.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1">5. Boş Kuyu Kuralı ("Öksüz" Kuralı)</h4>
                  <p>
                    Son taş kendi tarafınızdaki <strong>boş bir kuyuya</strong> düşerse ve o kuyunun tam karşısındaki rakip kuyuda taş varsa; hem koyduğunuz o 1 taşı hem de karşı kuyudaki tüm taşları kazanarak haznenize alırsınız.
                  </p>
                </section>

                <section>
                  <h4 className="text-amber-400 font-bold mb-1">6. Oyun Sonu & Kazanan</h4>
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
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* About Modal */}
        {showAboutModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl text-left"
            >
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-amber-500" />
                  Hakkımızda - Online Mangala Projesi
                </h3>
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  <strong>Online Mangala</strong>, asırlar boyu Türk göçer kültürünün en köklü zeka ve strateji oyunlarından biridir. Tarih boyunca kıraathanelerde, saraylarda ve askeri çadırlarda oynanan bu oyun, sadece bir eğlence aracı değil, aynı zamanda stratejik düşünme, öngörü yeteneği ve taktiksel zekayı geliştiren muazzam bir akıl egzersizidir.
                </p>
                <p>
                  Bu projenin amacı, bu kadim mirası modern teknolojiyle birleştirerek tüm dünyadan oyuncuların ve gelişmiş yapay zeka ajanlarının bir araya gelebileceği, tamamen Türkçe ve ücretsiz, kusursuz bir dijital arena sunmaktır.
                </p>
                <div className="bg-slate-900/60 p-4 border border-slate-750 rounded-xl space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Altyapı ve Teknolojiler:</h4>
                  <ul className="list-disc pl-4 space-y-1 text-xs text-slate-400">
                    <li>Gerçek zamanlı lobi ve multiplayer altyapısı için <strong>Firebase Firestore</strong></li>
                    <li>Google Kimlik Doğrulama entegrasyonu</li>
                    <li>Süper güçlü, yenilmez <strong>Zor+ Alpha-Beta Minimax Yapay Zeka Algoritması</strong></li>
                    <li>Arama motorlarının tam dizine ekleyebilmesi için profesyonel <strong>SEO Meta Etiketleri</strong></li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-900 px-6 py-4 border-t border-slate-700 flex justify-end">
                <button
                  onClick={() => setShowAboutModal(false)}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition cursor-pointer"
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
