// Synthesized audio: no asset files. SFX are throttled so swarms don't turn into noise.
let ctx = null, master = null, sfxBus = null, musicBus = null;
let muted = false, musicOn = true;
const last = {};
let noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; }
export function isMuted() { return muted; }
export function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.value = on ? 0.32 : 0; }
export function isMusicOn() { return musicOn; }

function throttle(key, ms) {
  const now = performance.now();
  if (last[key] && now - last[key] < ms) return false;
  last[key] = now; return true;
}

function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0, bus = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.3, freq = 1200, q = 1, type = 'lowpass', when = 0, bus = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const sfx = {
  hit() { if (throttle('hit', 45)) noise(0.05, 0.12, 2500, 1, 'bandpass'); },
  kill() { if (throttle('kill', 35)) tone(180 + Math.random() * 60, 0.09, 'square', 0.06, 60); },
  // pitch rises with the kindle combo: the core "slot machine" chime
  gem(combo = 0) {
    if (!throttle('gem', 28)) return;
    const idx = Math.min(PENTA.length - 1, Math.floor(combo / 12) % PENTA.length);
    tone(midi(76 + PENTA[idx]), 0.08, 'sine', 0.09);
  },
  cinder() { if (throttle('cinder', 50)) { tone(1320, 0.06, 'triangle', 0.1); tone(1760, 0.08, 'triangle', 0.08, null, 0.04); } },
  shoot() { if (throttle('shoot', 70)) tone(520, 0.06, 'triangle', 0.035, 240); },
  zap() { if (throttle('zap', 90)) { noise(0.12, 0.12, 4000, 2, 'highpass'); tone(900, 0.1, 'sawtooth', 0.04, 200); } },
  boom() { if (throttle('boom', 70)) { noise(0.35, 0.3, 500); tone(110, 0.3, 'sine', 0.25, 40); } },
  slash() { if (throttle('slash', 80)) noise(0.12, 0.12, 3000, 0.7, 'bandpass'); },
  pulse() { if (throttle('pulse', 120)) { tone(300, 0.4, 'sine', 0.15, 900); noise(0.3, 0.08, 6000, 1, 'highpass'); } },
  hurt() { if (throttle('hurt', 150)) { tone(220, 0.18, 'sawtooth', 0.15, 80); noise(0.1, 0.15, 800); } },
  heal() { [0, 4, 7, 12].forEach((n, i) => tone(midi(72 + n), 0.18, 'sine', 0.12, null, i * 0.05)); },
  levelup() {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(midi(67 + n), 0.25, 'triangle', 0.13, null, i * 0.045));
    tone(midi(43), 0.6, 'sine', 0.2);
  },
  select() { tone(midi(84), 0.08, 'square', 0.06); tone(midi(91), 0.12, 'square', 0.05, null, 0.05); },
  hover() { if (throttle('hover', 40)) tone(midi(96), 0.03, 'sine', 0.04); },
  chestDrum(i) { tone(midi(48 + (i % 5) * 3), 0.1, 'square', 0.08); noise(0.05, 0.1, 3000); },
  chestOpen() {
    [0, 7, 12, 16, 19, 24, 28, 31].forEach((n, i) => tone(midi(64 + n), 0.4, 'triangle', 0.12, null, i * 0.07));
    noise(0.8, 0.12, 8000, 1, 'highpass', 0.1);
  },
  fusion() {
    tone(midi(36), 1.4, 'sawtooth', 0.15, midi(48));
    [0, 3, 7, 10, 12, 15, 19, 24].forEach((n, i) => tone(midi(60 + n), 0.6, 'triangle', 0.1, null, 0.3 + i * 0.08));
  },
  flare() { tone(80, 1, 'sawtooth', 0.25, 600); noise(1.2, 0.3, 1500); tone(midi(84), 0.8, 'triangle', 0.15, null, 0.2); },
  blink() {
    if (!throttle('blink', 300)) return;
    noise(0.35, 0.18, 900, 3, 'bandpass');
    tone(900, 0.3, 'sine', 0.1, 120);
    tone(55, 0.6, 'sawtooth', 0.12, 40, 0.15);
  },
  shrineTick(p) { if (throttle('shrine', 220)) tone(midi(72 + Math.round(p * 12)), 0.18, 'sine', 0.06); },
  bossWarn() { [0, 0.5, 1].forEach((w) => { tone(110, 0.4, 'sawtooth', 0.2, 55, w); }); },
  pickup() { tone(midi(79), 0.1, 'triangle', 0.12); tone(midi(86), 0.15, 'triangle', 0.12, null, 0.07); },
  bomb() { noise(1, 0.5, 400); tone(60, 1, 'sine', 0.4, 25); },
  freeze() { [0, 5, 10].forEach((n, i) => tone(midi(88 + n), 0.5, 'sine', 0.1, null, i * 0.06)); noise(0.6, 0.1, 9000, 1, 'highpass'); },
  death() { tone(220, 1.5, 'sawtooth', 0.2, 30); noise(1.5, 0.2, 300); },
  victory() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => tone(midi(60 + n), 0.5, 'triangle', 0.14, null, i * 0.12)); },
  kindleUp(tier) { tone(midi(72 + tier * 3), 0.25, 'square', 0.07); tone(midi(79 + tier * 3), 0.3, 'square', 0.06, null, 0.06); },
  kindleLost() { tone(midi(64), 0.3, 'triangle', 0.08, midi(52)); },
};

// ---- Generative music: driving minor-pentatonic loop that intensifies with the run ----
let musicTimer = null, step = 0, intensity = 0, nextTime = 0;
// Per-stage procedural themes (original progressions, generated live)
const THEMES = {
  gloam: { bpm: 128, roots: [45, 45, 41, 43], arp: [0, 3, 7, 10, 12, 10, 7, 3], bass: 'sawtooth', lead: 'square', bell: false, drive: 1 },
  ashfields: { bpm: 142, roots: [40, 41, 40, 38], arp: [0, 1, 5, 7, 12, 7, 5, 1], bass: 'sawtooth', lead: 'sawtooth', bell: false, drive: 1.5 },
  marsh: { bpm: 96, roots: [43, 46, 41, 39], arp: [0, 3, 10, 12, 15, 12, 10, 3], bass: 'sine', lead: 'triangle', bell: true, drive: 0.8 },
  rimewood: { bpm: 108, roots: [50, 46, 48, 43], arp: [0, 7, 14, 15, 19, 15, 14, 7], bass: 'triangle', lead: 'sine', bell: true, drive: 0.6 },
};
let theme = THEMES.gloam;
export function setTheme(id) { theme = THEMES[id] || THEMES.gloam; }

export function setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); }

function kick(t) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.22);
}
function hat(t, v) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f).connect(g).connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.06);
}
function note(t, n, dur, type, vol, cutoff = 2400) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = midi(n);
  f.type = 'lowpass'; f.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
}

function schedule() {
  const th = theme, spb = 60 / th.bpm / 4; // 16th notes
  while (nextTime < ctx.currentTime + 0.15) {
    const t = nextTime, bar = Math.floor(step / 16) % th.roots.length, s16 = step % 16;
    const root = th.roots[bar];
    if (s16 % 4 === 0 && !(th.bell && s16 === 8 && intensity < 0.4)) kick(t);
    if (intensity > 0.15 && s16 % 2 === 1) hat(t, (0.04 + intensity * 0.05) * th.drive);
    if (s16 % 2 === 0) note(t, root - 12 + (s16 % 8 === 6 ? 12 : 0), spb * 1.8, th.bass, 0.09, (500 + intensity * 900) * th.drive);
    if (th.bell) {
      // sparse bell arpeggio: long sine tones on off-beats
      if (s16 % 4 === 2) note(t, root + 24 + th.arp[(s16 / 2 + bar) % 8], spb * 6, 'sine', 0.035 + intensity * 0.02, 6000);
    } else if (intensity > 0.3) note(t, root + 12 + th.arp[s16 % 8], spb * 0.9, th.lead, (0.025 + intensity * 0.02) * (th.lead === 'sawtooth' ? 0.7 : 1), 1800 + intensity * 2000);
    if (intensity > 0.6 && s16 % 8 === 4) noise(0.12, 0.12 * th.drive, 1800, 1, 'bandpass', t - ctx.currentTime, musicBus);
    if (s16 === 0) note(t, root + 24, spb * 14, 'triangle', th.bell ? 0.05 : 0.03, 3000);
    nextTime += spb; step++;
  }
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  nextTime = ctx.currentTime + 0.05; step = 0;
  musicTimer = setInterval(schedule, 40);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
