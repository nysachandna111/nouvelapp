// Personalization catalogs (Phase 2, Section 1). Cover + font choices are stored
// on the user profile as a string key and mapped to presentation here.

// 🎨 Custom Journal Covers — 5 aesthetics at launch. Each has a palette (header
// gradient), an accent color, and a decorative emoji (stands in for the texture
// illustration, since no image assets ship with this web build).
export const COVERS = {
  celestial: { key: 'celestial', label: 'Celestial', emoji: '🌙', accent: '#6b7a99',
    header: 'linear-gradient(135deg,#2b3a55 0%,#5a6b8c 55%,#c9d6e3 100%)', text: '#fdfcfa' },
  botanical: { key: 'botanical', label: 'Botanical', emoji: '🌿', accent: '#6f7d5a',
    header: 'linear-gradient(135deg,#3f5136 0%,#6f7d5a 55%,#cdd8b8 100%)', text: '#fdfcfa' },
  minimal: { key: 'minimal', label: 'Minimal', emoji: '◻️', accent: '#857861',
    header: 'linear-gradient(135deg,#efeae1 0%,#e2d8c6 100%)', text: '#2e2b27' },
  warm: { key: 'warm', label: 'Warm Abstract', emoji: '🔥', accent: '#b8703f',
    header: 'linear-gradient(135deg,#c98a4b 0%,#b8703f 55%,#e6c9a8 100%)', text: '#fdfcfa' },
  stone: { key: 'stone', label: 'Stone & Marble', emoji: '🪨', accent: '#8a8378',
    header: 'linear-gradient(135deg,#d9d3c7 0%,#b8ab97 60%,#8a8378 100%)', text: '#2e2b27' },
};
export const cover = (k) => COVERS[k] || COVERS.celestial;

// 🔤 Font Choice — applied to journal entry text only. Loaded via Google Fonts
// in index.html (adapted from expo-font bundling).
export const FONTS = {
  georgia: { key: 'georgia', label: 'Georgia', stack: "Georgia, 'Cormorant Garamond', serif" },
  lora: { key: 'lora', label: 'Lora', stack: "'Lora', Georgia, serif" },
  allison: { key: 'allison', label: 'Allison', stack: "'Allison', cursive" },
  dmsans: { key: 'dmsans', label: 'DM Sans', stack: "'DM Sans', system-ui, sans-serif" },
};
const LEGACY_FONT_KEYS = { playfair: 'georgia', merriweather: 'georgia' };
export const resolveFontKey = (k) => (FONTS[k] ? k : LEGACY_FONT_KEYS[k] || 'georgia');
export const fontStack = (k) => (FONTS[k] || FONTS[LEGACY_FONT_KEYS[k]] || FONTS.georgia).stack;

// 🎧 Ambient Sound — 5 options at launch. Synthesized on the client (see
// ambient.js) since no MP3 assets ship with this web build.
export const SOUNDS = [
  { key: 'rain', label: 'Rain', icon: '🌧️' },
  { key: 'forest', label: 'Forest', icon: '🌲' },
  { key: 'lofi', label: 'Lo-Fi', icon: '🎵' },
  { key: 'cafe', label: 'Café', icon: '☕' },
  { key: 'silence', label: 'Silence', icon: '🤫' },
];

// 🏷️ Entry Moods & Tags (post-save selector).
export const MOODS = [
  { key: 'joyful', emoji: '😊', label: 'Joyful' },
  { key: 'grateful', emoji: '🤩', label: 'Grateful' },
  { key: 'neutral', emoji: '😐', label: 'Neutral' },
  { key: 'unsettled', emoji: '😔', label: 'Unsettled' },
  { key: 'heavy', emoji: '😢', label: 'Heavy' },
  { key: 'energized', emoji: '🔥', label: 'Energized' },
  { key: 'tired', emoji: '😴', label: 'Tired' },
];
export const moodEmoji = (k) => (MOODS.find((m) => m.key === k) || {}).emoji || '';

export const LIFE_TAGS = ['Mind', 'Body', 'Relationships', 'Career', 'Creativity', 'Spirituality', 'Home'];
