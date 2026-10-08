import { Application } from 'pixi.js';
import { buildAtlas, atlasCanvas } from './atlas.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { initInput, consumePressed, padButtons } from './input.js';
import { initAudio, startMusic, setMuted, setMusic, setTheme } from './audio.js';
import { save } from './save.js';
import './style.css';

const app = new Application();
await app.init({
  resizeTo: window,
  background: '#0a0812',
  antialias: false,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  autoDensity: true,
  powerPreference: 'high-performance',
});
document.getElementById('game').appendChild(app.canvas);

buildAtlas();
initInput();
setMuted(save.settings.muted);
setMusic(save.settings.music);

let game = null;

const ui = new UI({
  startRun(charId, stageId = save.lastStage || 'gloam') {
    if (game) { game.destroy(); game = null; }
    initAudio();
    setTheme(stageId);
    startMusic();
    game = new Game(app, ui, charId, stageId);
    ui.beginRun(game);
    window.__game = game;
  },
  quitToTitle() {
    if (game) { game.destroy(); game = null; }
    ui.game = null;
  },
});

if (import.meta.env.DEV) {
  import('./devsim.js').then((m) => m.install((c) => ui.h.startRun(c), () => game));
  window.__atlas = atlasCanvas;
}

addEventListener('resize', () => game && game.resize());
addEventListener('keydown', (e) => {
  if (!game || game.dead) return;
  if ((e.code === 'Escape' || e.code === 'KeyP') && !ui.modalOpen) { e.preventDefault(); ui.showPause(game); }
});
document.addEventListener('visibilitychange', () => {
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
