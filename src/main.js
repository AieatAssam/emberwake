import { Application } from 'pixi.js';
import { buildAtlas, atlasCanvas } from './atlas.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { initInput, consumePressed, padButtons } from './input.js';
import { initAudio, startMusic, setMuted, setMusic, setVolumes } from './audio.js';
import { save } from './save.js';
import './style.css';

const coarse = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', coarse);

const app = new Application();
await app.init({
  resizeTo: window,
  background: '#0a0812',
  antialias: false,
  // phones: cap the render scale lower, a 3x screen is far more pixels than the swarm needs
  resolution: Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2),
  autoDensity: true,
  powerPreference: 'high-performance',
});
document.getElementById('game').appendChild(app.canvas);

buildAtlas();
initInput();
setVolumes(save.settings.volume / 100, save.settings.musicVolume / 100);
setMuted(save.settings.muted);
setMusic(save.settings.music);

let game = null;
// keep the screen awake during a run, and drop the long-press menu
let wakeLock = null;
async function holdAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { /* denied or unsupported */ }
}
addEventListener('contextmenu', (e) => e.preventDefault());
// browsers block audio until a gesture: the first click starts the menu music
addEventListener('pointerdown', () => { initAudio(); if (!game) startMusic('menu'); }, { once: true });

const ui = new UI({
  startRun(charId, stageId = save.lastStage || 'gloam', opts = {}) {
    if (game) { game.destroy(); game = null; }
    initAudio();
    startMusic(stageId);
    game = new Game(app, ui, charId, stageId, opts);
    holdAwake(true);
    ui.beginRun(game);
    if (import.meta.env.DEV) window.__game = game;
  },
  quitToTitle() {
    if (game) { game.destroy(); game = null; }
    ui.game = null;
    holdAwake(false);
    startMusic('menu');
  },
});

if (import.meta.env.DEV) {
  import('./devsim.js').then((m) => m.install((c, s, o) => ui.h.startRun(c, s, o), () => game));
  window.__atlas = atlasCanvas;
  import('./audio.js').then((a) => { window.__audio = a.audioDebug; });
}

addEventListener('resize', () => game && game.resize());
addEventListener('keydown', (e) => {
  if (!game || game.dead) return;
  if ((e.code === 'Escape' || e.code === 'KeyP') && !ui.modalOpen) { e.preventDefault(); ui.showPause(game); }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && game) holdAwake(true);
  if (document.hidden && game && !ui.modalOpen && !game.dead) ui.showPause(game);
});

app.ticker.add((ticker) => {
  const dt = Math.min(ticker.deltaMS / 1000, 1 / 30);
  if (!game) return;
  if (padButtons().pause && !ui.modalOpen && !game.dead) ui.showPause(game);
  if (!ui.modalOpen) game.update(dt);
  else consumePressed('Space');
  game.render(ui.modalOpen ? 0 : dt);
});

ui.showTitle();
document.getElementById('loading')?.remove();
