export const BOARDS = {
  classic: { id: 'classic', name: 'Klasik', price: 0, themeClass: 'bg-gradient-to-b from-amber-800 to-amber-900 border-amber-950' },
  marble: { id: 'marble', name: 'Mermer', price: 100, themeClass: 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-400' },
  mahogany: { id: 'mahogany', name: 'Maun Ağacı', price: 250, themeClass: 'bg-gradient-to-b from-red-900 to-stone-900 border-red-950' },
  space: { id: 'space', name: 'Kozmik Uzay', price: 500, themeClass: 'bg-gradient-to-b from-indigo-900 to-slate-900 border-indigo-950 shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
};

export const STONES = {
  classic: { id: 'classic', name: 'Klasik Taş', price: 0, shadow: 'shadow-md shadow-amber-900/40', style: { background: 'linear-gradient(135deg, #a3e635, #4d7c0f)' } },
  gold: { id: 'gold', name: 'Saf Altın', price: 150, shadow: 'shadow-lg shadow-yellow-500/50', style: { background: 'linear-gradient(135deg, #fef08a, #ca8a04)' } },
  sapphire: { id: 'sapphire', name: 'Safir', price: 300, shadow: 'shadow-lg shadow-blue-500/50', style: { background: 'linear-gradient(135deg, #93c5fd, #1d4ed8)' } },
  ruby: { id: 'ruby', name: 'Yakut', price: 300, shadow: 'shadow-lg shadow-red-500/50', style: { background: 'linear-gradient(135deg, #fca5a5, #b91c1c)' } },
  obsidian: { id: 'obsidian', name: 'Obsidyen', price: 600, shadow: 'shadow-lg shadow-purple-900/60', style: { background: 'linear-gradient(135deg, #475569, #0f172a)' } },
};

export const EMOTES = [
  { id: 'clap', emoji: '👏', label: 'Tebrikler' },
  { id: 'cry', emoji: '😢', label: 'Ah be!' },
  { id: 'angry', emoji: '😡', label: 'Kızgın' },
  { id: 'party', emoji: '🎉', label: 'Şahane' },
  { id: 'mindblown', emoji: '🤯', label: 'Zekice!' },
  { id: 'think', emoji: '🤔', label: 'Düşünüyorum...' },
];
