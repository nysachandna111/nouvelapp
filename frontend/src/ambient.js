// 🎧 Ambient Sound engine.
// The Phase 2 spec bundles looping MP3s via expo-av. This is a web build with no
// binary audio assets, so we synthesize soft ambient textures with the Web Audio
// API instead — fully offline, gapless (looping noise buffers), and with app-level
// volume that is independent of device media volume, exactly as the spec requires.

let ctx = null;
let master = null;
let nodes = [];
let current = 'silence';
let volume = 0.45;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  return ctx;
}

// A 2-second looping noise buffer. type shapes the spectral color.
function noiseBuffer(c, type) {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else if (type === 'pink') {
      last = 0.97 * last + 0.03 * w;
      d[i] = (w + last * 3) * 0.28;
    } else {
      d[i] = w;
    }
  }
  return buf;
}

function layer(c, { type, freq, q = 0.6, gain = 0.5, lfo = 0 }) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, type);
  src.loop = true;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = freq;
  filt.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filt).connect(g);
  // Gentle amplitude drift so the texture breathes (rain gusts, café swell).
  if (lfo) {
    const osc = c.createOscillator();
    osc.frequency.value = lfo;
    const depth = c.createGain();
    depth.gain.value = gain * 0.35;
    osc.connect(depth).connect(g.gain);
    osc.start();
  }
  return { src, out: g };
}

// Each sound is a small stack of filtered-noise layers.
const RECIPES = {
  rain: (c) => [layer(c, { type: 'white', freq: 3600, gain: 0.35, lfo: 0.15 }), layer(c, { type: 'pink', freq: 1200, gain: 0.25 })],
  forest: (c) => [layer(c, { type: 'pink', freq: 1500, gain: 0.3, lfo: 0.08 }), layer(c, { type: 'white', freq: 6000, q: 3, gain: 0.06 })],
  cafe: (c) => [layer(c, { type: 'brown', freq: 900, gain: 0.4, lfo: 0.05 })],
  lofi: (c) => [layer(c, { type: 'brown', freq: 500, gain: 0.5, lfo: 0.12 }), layer(c, { type: 'pink', freq: 900, gain: 0.12 })],
  silence: () => [],
};

export function play(key) {
  stop();
  current = key || 'silence';
  if (current === 'silence' || !RECIPES[current]) return;
  const c = ac();
  if (c.state === 'suspended') c.resume();
  nodes = RECIPES[current](c);
  nodes.forEach((n) => {
    n.out.connect(master);
    n.src.start();
  });
}

export function stop() {
  nodes.forEach((n) => {
    try { n.src.stop(); } catch { /* already stopped */ }
    try { n.out.disconnect(); } catch { /* noop */ }
  });
  nodes = [];
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

export const getVolume = () => volume;
export const currentSound = () => current;
export const isPlaying = () => nodes.length > 0;
