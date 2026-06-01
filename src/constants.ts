export const BOARDS = {
  classic: { id: 'classic', name: 'Klasik', price: 0, themeClass: 'bg-gradient-to-b from-amber-800 to-amber-900 border-amber-950' },
  walnut: { id: 'walnut', name: 'Ceviz Ağacı', price: 50, themeClass: 'bg-gradient-to-b from-stone-700 to-stone-900 border-stone-800' },
  marble: { id: 'marble', name: 'Beyaz Mermer', price: 100, themeClass: 'bg-gradient-to-b from-slate-200 to-slate-400 border-slate-500' },
  malachite: { id: 'malachite', name: 'Malahit', price: 150, themeClass: 'bg-gradient-to-b from-emerald-700 to-teal-900 border-teal-950 shadow-[0_0_10px_rgba(45,212,191,0.3)]' },
  mahogany: { id: 'mahogany', name: 'Maun Ağacı', price: 250, themeClass: 'bg-gradient-to-b from-red-900 to-stone-900 border-red-950' },
  neon: { id: 'neon', name: 'Cyberpunk Neon', price: 400, themeClass: 'bg-gradient-to-b from-fuchsia-900 to-violet-950 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.6)]' },
  space: { id: 'space', name: 'Kozmik Uzay', price: 500, themeClass: 'bg-gradient-to-b from-indigo-900 to-slate-900 border-indigo-950 shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
  gold_plated: { id: 'gold_plated', name: 'Altın Kaplama', price: 750, themeClass: 'bg-gradient-to-b from-yellow-600 to-yellow-800 border-yellow-500 shadow-[0_0_25px_rgba(234,179,8,0.7)]' },
};

export const STONES = {
  classic: { id: 'classic', name: 'Klasik Taş', price: 0, shadow: 'shadow-md shadow-amber-900/40', style: { background: 'linear-gradient(135deg, #a3e635, #4d7c0f)' } },
  clay: { id: 'clay', name: 'Pişmiş Toprak', price: 50, shadow: 'shadow-md shadow-orange-900/40', style: { background: 'linear-gradient(135deg, #ea580c, #7c2d12)' } },
  ivory: { id: 'ivory', name: 'Fildişi', price: 100, shadow: 'shadow-lg shadow-gray-400/50', style: { background: 'linear-gradient(135deg, #f8fafc, #cbd5e1)' } },
  gold: { id: 'gold', name: 'Saf Altın', price: 150, shadow: 'shadow-lg shadow-yellow-500/50', style: { background: 'linear-gradient(135deg, #fef08a, #ca8a04)' } },
  emerald: { id: 'emerald', name: 'Zümrüt', price: 200, shadow: 'shadow-lg shadow-emerald-500/50', style: { background: 'linear-gradient(135deg, #34d399, #047857)' } },
  sapphire: { id: 'sapphire', name: 'Safir', price: 300, shadow: 'shadow-lg shadow-blue-500/50', style: { background: 'linear-gradient(135deg, #93c5fd, #1d4ed8)' } },
  ruby: { id: 'ruby', name: 'Yakut', price: 300, shadow: 'shadow-lg shadow-red-500/50', style: { background: 'linear-gradient(135deg, #fca5a5, #b91c1c)' } },
  amethyst: { id: 'amethyst', name: 'Ametist', price: 400, shadow: 'shadow-lg shadow-fuchsia-500/50', style: { background: 'linear-gradient(135deg, #e879f9, #a21caf)' } },
  obsidian: { id: 'obsidian', name: 'Obsidyen', price: 600, shadow: 'shadow-lg shadow-purple-900/60', style: { background: 'linear-gradient(135deg, #475569, #0f172a)' } },
  diamond: { id: 'diamond', name: 'Elmas', price: 1000, shadow: 'shadow-xl shadow-cyan-300/80', style: { background: 'linear-gradient(135deg, #cffafe, #06b6d4, #cffafe)', boxShadow: 'inset 0 0 10px rgba(255,255,255,0.8)' } },
};

export const EMOTES = [
  { id: 'clap', emoji: '👏', label: 'Tebrikler' },
  { id: 'cry', emoji: '😢', label: 'Ah be!' },
  { id: 'angry', emoji: '😡', label: 'Kızgın' },
  { id: 'party', emoji: '🎉', label: 'Şahane' },
  { id: 'mindblown', emoji: '🤯', label: 'Zekice!' },
  { id: 'think', emoji: '🤔', label: 'Düşünüyorum...' },
];
