// Procedural sprite atlas. Every sprite in Emberwake is drawn here with Canvas2D
// into ONE texture source, so all ParticleContainers can batch from it.
import { Texture, Rectangle, CanvasSource } from 'pixi.js';

// Logical atlas size; the backing canvas is supersampled SS× for crisp sprites on
// HiDPI screens and camera zoom. Pixi maps it back via the source's resolution.
const SIZE = 2048, SIZE_H = 1280;
export const SS = 2;
export const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = SIZE * SS;
atlasCanvas.height = SIZE_H * SS;
const actx = atlasCanvas.getContext('2d', { willReadFrequently: true });

const frames = {};
export const T = {};
let sx = 0, sy = 0, sh = 0;
const PAD = 2;

function alloc(w, h) {
  if (sx + w + PAD > SIZE) { sx = 0; sy += sh + PAD; sh = 0; }
  if (sy + h > SIZE_H) console.warn('atlas overflow', w, h);
  const r = { x: sx, y: sy, w, h };
  sx += w + PAD;
  sh = Math.max(sh, h);
  return r;
}

function make(name, w, h, draw) {
  const r = alloc(w, h);
  actx.save();
  actx.translate(r.x * SS, r.y * SS);
  actx.scale(SS, SS);
  actx.beginPath();
  actx.rect(0, 0, w, h);
  actx.clip();
  draw(actx, w, h);
  actx.restore();
  frames[name] = r;
  return r;
}

// Hit-flash variant of a frame: solid body pixels turn white, while soft pixels
// (drop shadows, glows, coronas) keep their colour so flashes read as the creature.
function makeWhite(name) {
  const src = frames[name];
  const r = alloc(src.w, src.h);
  const img = actx.getImageData(src.x * SS, src.y * SS, src.w * SS, src.h * SS);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a > 150) { const k = (a - 150) / 105; d[i] += (255 - d[i]) * k; d[i + 1] += (255 - d[i + 1]) * k; d[i + 2] += (255 - d[i + 2]) * k; }
  }
  actx.putImageData(img, r.x * SS, r.y * SS);
  frames[name + '_w'] = r;
}

// ---------- drawing helpers ----------
const TAU = Math.PI * 2;
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function circle(c, x, y, r, fill, stroke, lw = 2) {
  c.beginPath(); c.arc(x, y, r, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function ellipse(c, x, y, rx, ry, fill, stroke, lw = 2) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
}
function radial(c, x, y, r, stops) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
function glowDot(c, x, y, r, col) {
  c.fillStyle = radial(c, x, y, r, [[0, '#fff'], [0.3, col], [1, 'rgba(0,0,0,0)']]);
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function shadow(c, x, y, rx, ry = rx * 0.35) {
  c.fillStyle = radial(c, 0, 0, 1, [[0, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]);
  c.save(); c.translate(x, y); c.scale(rx, ry);
  c.beginPath(); c.arc(0, 0, 1, 0, TAU); c.fill(); c.restore();
}
function eye(c, x, y, r, col) {
  glowDot(c, x, y, r * 2.2, col);
  circle(c, x, y, r, '#fff');
  circle(c, x, y, r * 0.5, col);
}
function poly(c, pts, fill, stroke, lw = 2) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.lineJoin = 'round'; c.stroke(); }
}
function star(x, y, r1, r2, n, rot = 0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU, r = i % 2 ? r2 : r1;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return pts;
}
const OUT = '#0b0614';

// ---------- FX ----------
function drawFX() {
  make('glow', 64, 64, (c) => {
    c.fillStyle = radial(c, 32, 32, 32, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 64, 64);
  });
  make('softglow', 128, 128, (c) => {
    c.fillStyle = radial(c, 64, 64, 64, [[0, 'rgba(255,255,255,0.7)'], [0.5, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 128, 128);
  });
  make('dot', 12, 12, (c) => {
    c.fillStyle = radial(c, 6, 6, 6, [[0, '#fff'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 12, 12);
  });
  make('spark', 24, 24, (c) => {
    c.fillStyle = radial(c, 12, 12, 12, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 24, 24);
    poly(c, star(12, 12, 12, 2, 4, 0), '#fff');
  });
  make('shard', 12, 12, (c) => poly(c, [[6, 0], [12, 6], [6, 12], [0, 6]], '#fff'));
  make('streak', 32, 6, (c) => {
    c.fillStyle = lin(c, 0, 0, 32, 0, [[0, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.8)'], [1, '#fff']]);
    c.beginPath(); c.ellipse(16, 3, 16, 3, 0, 0, TAU); c.fill();
  });
  make('smoke', 40, 40, (c) => {
    for (let i = 0; i < 6; i++) {
      const x = 20 + (rnd() - 0.5) * 14, y = 20 + (rnd() - 0.5) * 14;
      c.fillStyle = radial(c, x, y, 13, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
      c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill();
    }
  });
  make('ring', 128, 128, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 10;
    c.beginPath(); c.arc(64, 64, 57, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.stroke();
  });
  make('aura', 160, 160, (c) => {
    c.fillStyle = radial(c, 80, 80, 80, [[0, 'rgba(255,255,255,0)'], [0.65, 'rgba(255,255,255,0.05)'], [0.92, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 160, 160);
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2; c.setLineDash([10, 8]);
    c.beginPath(); c.arc(80, 80, 72, 0, TAU); c.stroke();
  });
  make('beam', 64, 28, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 28, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.4)'], [0.5, '#fff'], [0.7, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 64, 28);
  });
  make('bolt_seg', 32, 10, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, 10, [[0, 'rgba(255,255,255,0)'], [0.5, '#fff'], [1, 'rgba(255,255,255,0)']]);
    c.fillRect(0, 0, 32, 10);
  });
  make('slash', 128, 128, (c) => {
    // crescent arc pointing right
    c.save(); c.translate(64, 64);
    const g = c.createLinearGradient(0, -60, 0, 60);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 60, -1.3, 1.3); c.arc(-18, 0, 50, 1.2, -1.2, true); c.closePath(); c.fill();
    c.restore();
  });
  make('target', 64, 64, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3; c.setLineDash([8, 6]);
    c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(32, 32, 28, 0, TAU); c.fill();
  });
  make('shadow', 48, 18, (c) => shadow(c, 24, 9, 23, 8));
  make('pixel', 4, 4, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 4, 4); });
}

// ---------- projectiles ----------
function drawProjectiles() {
  // Ember Bolt: comet-shaped flame pointing right (+x), two flicker frames
  for (const f of [0, 1]) make('flame' + f, 44, 26, (c) => {
    c.save(); c.translate(30, 13);
    c.fillStyle = radial(c, 0, 0, 16, [[0, 'rgba(255,170,60,0.8)'], [1, 'rgba(255,80,0,0)']]);
    c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill();
    const tail = f ? 30 : 26, wob = f ? 2 : -2;
    const shape = (len, w, col) => {
      c.beginPath(); c.moveTo(9, 0);
      c.bezierCurveTo(8, -w, -len * 0.4, -w * 0.8 + wob, -len, wob * 0.5);
      c.bezierCurveTo(-len * 0.4, w * 0.8 + wob, 8, w, 9, 0);
      c.fillStyle = col; c.fill();
    };
    shape(tail, 8, 'rgba(255,90,20,0.85)');
    shape(tail * 0.72, 5.5, '#ffb43a');
    shape(tail * 0.42, 3.4, '#fff1b8');
    circle(c, 4, 0, 3, '#fff');
    c.restore();
  });
  make('bolt', 32, 32, (c) => {
    glowDot(c, 16, 16, 16, 'rgba(255,140,40,0.9)');
    circle(c, 16, 16, 7, '#ffd27a');
    circle(c, 16, 16, 4, '#fff');
  });
  make('blade', 40, 40, (c) => {
    c.save(); c.translate(20, 20);
    glowDot(c, 0, 0, 20, 'rgba(120,220,255,0.35)');
    c.beginPath(); c.arc(0, 0, 15, -2.2, 0.8); c.arc(5, -3, 10, 0.6, -2.0, true); c.closePath();
    c.fillStyle = lin(c, -15, -15, 15, 15, [[0, '#e8fbff'], [1, '#6cc8f0']]); c.fill();
    c.lineWidth = 1.5; c.strokeStyle = '#0d2a3a'; c.stroke();
    c.restore();
  });
  // Wisp spirit: teal teardrop with tiny eyes, pointing right (+x), two flutter frames
  for (const f of [0, 1]) make('spirit' + f, 36, 24, (c) => {
    c.save(); c.translate(24, 12);
    glowDot(c, 0, 0, 12, 'rgba(120,255,220,0.55)');
    const w = f ? 2.5 : -2.5;
    c.beginPath(); c.moveTo(8, 0);
    c.bezierCurveTo(7, -7, -6, -6 + w, -20, w);
    c.bezierCurveTo(-6, 6 + w, 7, 7, 8, 0);
    c.fillStyle = lin(c, -20, 0, 8, 0, [[0, 'rgba(60,200,180,0)'], [0.5, 'rgba(110,240,210,0.85)'], [1, '#e6fff9']]); c.fill();
    circle(c, 1, 0, 5.5, '#c8fff2');
    circle(c, 2.6, -1.8, 1.2, '#0a3a34'); circle(c, 2.6, 1.8, 1.2, '#0a3a34');
    c.restore();
  });
  // Drone spark: cyan core with jagged electric arcs, two crackle frames
  for (const f of [0, 1]) make('zap' + f, 22, 22, (c) => {
    glowDot(c, 11, 11, 11, 'rgba(110,230,255,0.75)');
    c.strokeStyle = '#e8fdff'; c.lineWidth = 1.4; c.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + (f ? 0.6 : 0.1);
      c.beginPath(); c.moveTo(11, 11);
      c.lineTo(11 + Math.cos(a + 0.4) * 5, 11 + Math.sin(a + 0.4) * 5);
      c.lineTo(11 + Math.cos(a - 0.2) * 9, 11 + Math.sin(a - 0.2) * 9);
      c.stroke();
    }
    circle(c, 11, 11, 3.2, '#ffffff');
  });
  make('wisp', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, 'rgba(140,255,230,0.8)');
    circle(c, 14, 14, 5, '#e6fff9');
  });
  make('glaive', 48, 48, (c) => {
    c.save(); c.translate(24, 24);
    glowDot(c, 0, 0, 24, 'rgba(210,200,255,0.4)');
    for (let i = 0; i < 3; i++) {
      c.rotate(TAU / 3);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(14, -6, 20, -18); c.quadraticCurveTo(10, -4, 0, 0);
      c.fillStyle = '#e9e4ff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#3a2f6a'; c.stroke();
    }
    circle(c, 0, 0, 6, '#b9a8ff', '#3a2f6a', 1.5);
    c.restore();
  });
  make('meteor', 48, 48, (c) => {
    glowDot(c, 24, 24, 24, 'rgba(255,110,30,0.8)');
    poly(c, [[14, 18], [24, 10], [35, 15], [38, 27], [30, 37], [17, 35], [11, 27]], '#5a3424', '#ffb15a', 2);
    circle(c, 26, 22, 4, '#ffcf8a'); circle(c, 19, 29, 3, '#ff8a3a');
  });
  make('mine', 32, 32, (c) => {
    c.save(); c.translate(16, 16);
    for (let i = 0; i < 6; i++) {
      c.rotate(TAU / 6);
      ellipse(c, 0, -8, 4.5, 8, '#ff7ab8', '#4a0f2c', 1.5);
    }
    circle(c, 0, 0, 6, '#ffe36e', '#4a0f2c', 1.5);
    c.restore();
  });
  make('drone', 36, 36, (c) => {
    c.save(); c.translate(18, 18);
    glowDot(c, 0, 4, 14, 'rgba(120,200,255,0.4)');
    ellipse(c, -11, -6, 6, 2.5, '#9fb8c8', OUT, 1.2); ellipse(c, 11, -6, 6, 2.5, '#9fb8c8', OUT, 1.2);
    poly(c, [[-9, -2], [9, -2], [11, 6], [0, 11], [-11, 6]], '#c9a45a', OUT, 2);
    circle(c, 0, 3, 4, '#7ef0ff');
    circle(c, 0, 3, 2, '#fff');
    c.restore();
  });
  make('orb', 20, 20, (c) => {
    glowDot(c, 10, 10, 10, 'rgba(200,60,255,0.9)');
    circle(c, 10, 10, 4, '#ffd0ff');
  });
  make('icicle', 28, 12, (c) => {
    poly(c, [[0, 6], [8, 1], [28, 6], [8, 11]], '#d9f6ff', '#3b7ca8', 1.5);
  });
  make('vortex', 128, 128, (c) => {
    c.save(); c.translate(64, 64);
    c.fillStyle = radial(c, 0, 0, 64, [[0, 'rgba(255,255,255,0.95)'], [0.12, 'rgba(200,140,255,0.9)'], [0.35, 'rgba(90,30,160,0.55)'], [1, 'rgba(20,0,40,0)']]);
    c.beginPath(); c.arc(0, 0, 64, 0, TAU); c.fill();
    for (let arm = 0; arm < 4; arm++) {
      c.save(); c.rotate((arm / 4) * TAU);
      c.beginPath();
      for (let t = 0; t <= 1; t += 0.04) {
        const r = 8 + t * 54, a = t * 3.4;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (t === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.lineWidth = 5; c.strokeStyle = 'rgba(230,200,255,0.75)'; c.lineCap = 'round'; c.stroke();
      c.restore();
    }
    circle(c, 0, 0, 7, '#0a0014', 'rgba(255,230,255,0.9)', 2);
    c.restore();
  });
  make('feather', 30, 14, (c) => {
    glowDot(c, 15, 7, 12, 'rgba(255,240,180,0.5)');
    ellipse(c, 15, 7, 13, 4, '#fff4d6', '#9a7a3a', 1.2);
  });
}

// ---------- pickups ----------
// pips: tier marks (0-4) so gem value reads without relying on colour
function gem(name, light, mid, dark, s = 1, pips = 0) {
  const w = Math.round(22 * s), h = Math.round(28 * s);
  make(name, w, h, (c) => {
    c.save(); c.scale(s, s);
    glowDot(c, 11, 14, 13, mid.replace(')', ',0.35)').replace('rgb', 'rgba'));
    poly(c, [[11, 2], [19, 12], [11, 26], [3, 12]], mid, dark, 1.6);
    poly(c, [[11, 2], [19, 12], [11, 14]], light);
    poly(c, [[3, 12], [11, 14], [11, 26]], dark);
    circle(c, 9, 9, 1.6, '#fff');
    for (let i = 0; i < pips; i++) {
      const x = 11 + (i - (pips - 1) / 2) * 3.4;
      poly(c, [[x, 17], [x + 1.4, 18.6], [x, 20.2], [x - 1.4, 18.6]], '#ffffff', 'rgba(0,0,0,0.55)', 0.6);
    }
    c.restore();
  });
}
function drawPickups() {
  gem('gem0', '#bfe9ff', 'rgb(70,170,255)', '#13335e');
  gem('gem1', '#c9ffcf', 'rgb(60,220,110)', '#0f4a26', 1, 1);
  gem('gem2', '#ffd0d0', 'rgb(255,70,90)', '#5a0f1c', 1, 2);
  gem('gem3', '#f1d4ff', 'rgb(190,90,255)', '#3a0f5a', 1, 3);
  gem('gem4', '#fff3c4', 'rgb(255,200,60)', '#5a3a0a', 1.4, 4);
  make('heart', 28, 26, (c) => {
    glowDot(c, 14, 13, 14, 'rgba(255,80,110,0.45)');
    c.beginPath(); c.moveTo(14, 23); c.bezierCurveTo(-2, 12, 4, 0, 14, 7); c.bezierCurveTo(24, 0, 30, 12, 14, 23);
    c.fillStyle = '#ff4f6d'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#4a0614'; c.stroke();
    ellipse(c, 9, 9, 3, 2, '#ffc2cc');
  });
  make('magnet', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, 'rgba(120,180,255,0.45)');
    c.lineCap = 'butt'; c.lineWidth = 7; c.strokeStyle = OUT;
    c.beginPath(); c.arc(14, 13, 8, Math.PI, 0); c.lineTo(22, 22); c.moveTo(6, 13); c.lineTo(6, 22); c.stroke();
    c.lineWidth = 4.5; c.strokeStyle = '#e04050';
    c.beginPath(); c.arc(14, 13, 8, Math.PI, 0); c.stroke();
    c.strokeStyle = '#dfe8ff'; c.beginPath(); c.moveTo(6, 13); c.lineTo(6, 22); c.moveTo(22, 13); c.lineTo(22, 22); c.stroke();
  });
  make('bomb', 30, 30, (c) => {
    glowDot(c, 15, 15, 15, 'rgba(255,220,90,0.5)');
    poly(c, star(15, 16, 13, 6, 8, -Math.PI / 2), '#ffcf3a', '#5a3200', 2);
    circle(c, 15, 16, 5, '#fff7d0');
  });
  make('freeze', 30, 30, (c) => {
    glowDot(c, 15, 15, 15, 'rgba(140,220,255,0.5)');
    c.save(); c.translate(15, 15); c.strokeStyle = '#0c2c44'; c.lineWidth = 5; c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 3; i++) {
        c.save(); c.rotate((i * Math.PI) / 3);
        c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 11); c.moveTo(-4, -8); c.lineTo(0, -5); c.lineTo(4, -8); c.moveTo(-4, 8); c.lineTo(0, 5); c.lineTo(4, 8); c.stroke();
        c.restore();
      }
      c.strokeStyle = '#d6f4ff'; c.lineWidth = 2.2;
    }
    c.restore();
  });
  make('cinder', 18, 18, (c) => {
    glowDot(c, 9, 9, 9, 'rgba(255,150,40,0.6)');
    circle(c, 9, 9, 6, '#ffb03a', '#5a2a00', 1.5);
    poly(c, [[9, 4], [11.5, 9], [9, 14], [6.5, 9]], '#fff1c2');
  });
  make('flareorb', 28, 28, (c) => {
    glowDot(c, 14, 14, 14, 'rgba(255,90,200,0.7)');
    poly(c, star(14, 14, 10, 4, 4, Math.PI / 4), '#ffd6f4', '#5a0a40', 1.5);
  });
  make('chest', 44, 38, (c) => {
    shadow(c, 22, 33, 20, 5);
    glowDot(c, 22, 18, 22, 'rgba(255,200,80,0.35)');
    c.fillStyle = '#6a3a1a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(5, 15, 34, 18, 3); c.fill(); c.stroke();
    c.fillStyle = '#8a4e22'; c.beginPath(); c.roundRect(4, 6, 36, 12, [8, 8, 2, 2]); c.fill(); c.stroke();
    c.fillStyle = '#ffcf4a'; c.fillRect(19, 6, 6, 27); c.fillRect(4, 15, 36, 3);
    c.strokeRect(19, 6, 6, 27);
    circle(c, 22, 19, 3.5, '#fff1b0', OUT, 1.5);
  });
}

// ---------- characters ----------
// STEP (-1, 0, 1) poses the legs for the walk cycle frames
let STEP = 0;
// Each Bearer gets an idle frame plus two stepping frames (_s1, _s2)
function makeChar(name, draw) {
  for (const [suffix, st] of [['', 0], ['_s1', 1], ['_s2', -1]]) {
    STEP = st;
    make(name + suffix, 64, 64, (c) => { c.translate(0, st ? -1 : 0); draw(c); });
  }
  STEP = 0;
}
// Bearers are drawn chibi: oversized heads, big glossy eyes, a strong silhouette and one signature prop each.
function bigEye(c, x, y, iris, rx = 3.6, ry = 4.6) {
  ellipse(c, x, y, rx, ry, '#fff', OUT, 1.6);
  ellipse(c, x + 0.4, y + 0.7, rx * 0.72, ry * 0.78, iris);
  circle(c, x + 0.4, y + 1, rx * 0.36, '#140a1c');
  circle(c, x - 0.9, y - 1.5, 1.3, '#fff');
}
function smile(c, x, y, w, col = OUT) {
  c.strokeStyle = col; c.lineWidth = 1.8; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, w, 0.25, Math.PI - 0.25); c.stroke();
}
function blush(c, x, y) { ellipse(c, x, y, 3.2, 2, 'rgba(255,110,120,0.55)'); }
// short chibi legs with boots
function boots(c, cx, col, boot) {
  const l = STEP * 3;
  for (const [dx, lift] of [[-6, Math.max(0, l)], [2, Math.max(0, -l)]]) {
    c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(cx + dx + STEP, 49 - lift, 6, 8, 2); c.fill(); c.stroke();
    c.fillStyle = boot; c.beginPath(); c.roundRect(cx + dx - 1 + STEP, 55 - lift, 8, 4, 2); c.fill(); c.stroke();
  }
}
function drawCharacters() {
  // Kael — Ashen Warden: grey hood, big amber eyes, trailing ember-orange scarf, lantern holding the last Ember
  makeChar('warden', (c) => {
    shadow(c, 32, 59, 17, 5);
    boots(c, 32, '#3a3346', '#2a2232');
    // scarf tail streams behind, swaying with the stride
    c.fillStyle = '#e8662a'; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.moveTo(24, 36); c.quadraticCurveTo(10, 38 + STEP * 2, 4, 46 - STEP * 2); c.lineTo(9, 50 - STEP * 2); c.quadraticCurveTo(16, 44, 26, 42); c.closePath(); c.fill(); c.stroke();
    poly(c, [[19, 50], [21, 33], [43, 33], [45, 50]], '#6b6478', OUT, 2.5);
    poly(c, [[26, 50], [27, 36], [37, 36], [38, 50]], '#8a8296');
    c.fillStyle = '#ff8a3a'; c.beginPath(); c.roundRect(22, 33, 20, 6, 3); c.fill(); c.stroke(); // scarf wrap
    // big hood
    c.beginPath(); c.moveTo(16, 30); c.bezierCurveTo(14, 8, 28, 3, 32, 3); c.bezierCurveTo(36, 3, 50, 8, 48, 30); c.quadraticCurveTo(32, 36, 16, 30);
    c.fillStyle = lin(c, 0, 3, 0, 32, [[0, '#7a7288'], [1, '#585068']]); c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 32, 21, 11.5, 9.5, '#160e22');
    bigEye(c, 27.5, 21, '#ffb030'); bigEye(c, 36.5, 21, '#ffb030');
    glowDot(c, 27.5, 21, 7, 'rgba(255,170,40,0.35)'); glowDot(c, 36.5, 21, 7, 'rgba(255,170,40,0.35)');
    // lantern
    c.strokeStyle = '#2a2232'; c.lineWidth = 2; c.beginPath(); c.moveTo(46, 38); c.lineTo(51, 42); c.stroke();
    glowDot(c, 52, 49, 15, 'rgba(255,150,40,0.9)');
    c.fillStyle = '#d0a040'; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(47, 43, 10, 12, 3); c.fill(); c.stroke();
    circle(c, 52, 49, 3.4, '#fff4c0');
    poly(c, [[52, 36], [55, 42], [49, 42]], '#ffb040');
  });
  // Ysolde — Rime Oracle: long frost-white hair, crystal tiara, star-bright eyes, floating-orb staff
  makeChar('oracle', (c) => {
    shadow(c, 32, 59, 16, 5);
    // long hair behind
    c.fillStyle = '#dff4ff'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(16, 18); c.bezierCurveTo(8, 34, 12, 48, 20 + STEP * 2, 52); c.lineTo(44 + STEP * 2, 52); c.bezierCurveTo(52, 48, 56, 34, 48, 18); c.closePath(); c.fill(); c.stroke();
    boots(c, 32, '#2d5d8c', '#1a3d66');
    poly(c, [[18 + STEP * 2, 54], [22, 33], [42, 33], [46 + STEP * 2, 54]], '#3d86c8', OUT, 2.5);
    poly(c, [[26 + STEP, 54], [28, 36], [36, 36], [38 + STEP, 54]], '#cdeeff');
    c.fillStyle = '#7fd8ff'; c.beginPath(); c.roundRect(24, 34, 16, 4, 2); c.fill();
    // head
    circle(c, 32, 21, 13, '#f6e2d2', OUT, 2.5);
    c.fillStyle = '#e8f8ff'; c.beginPath(); c.moveTo(19, 22); c.bezierCurveTo(18, 6, 46, 6, 45, 22); c.quadraticCurveTo(40, 12, 32, 13); c.quadraticCurveTo(24, 12, 19, 22);
    c.fill(); c.stroke();
    bigEye(c, 27, 23, '#38b8ff', 3.4, 4.4); bigEye(c, 37, 23, '#38b8ff', 3.4, 4.4);
    blush(c, 22.5, 28); blush(c, 41.5, 28); smile(c, 32, 28.5, 2.2);
    // tiara
    poly(c, [[22, 11], [25, 0], [29, 8], [32, -2], [35, 8], [39, 0], [42, 11]], '#9fe6ff', OUT, 2);
    glowDot(c, 32, 5, 7, 'rgba(160,235,255,0.8)');
    // staff with floating orb
    c.strokeStyle = '#dfe9f2'; c.lineWidth = 3; c.beginPath(); c.moveTo(52, 56); c.lineTo(53, 28); c.stroke();
    glowDot(c, 53, 22 + STEP, 13, 'rgba(120,225,255,0.9)');
    poly(c, [[53, 14 + STEP], [57, 22 + STEP], [53, 30 + STEP], [49, 22 + STEP]], '#f0fdff', '#2a6a9a', 1.5);
  });
  // Pip — Clockwork Tinker: tiny, spiky ginger hair, huge goggles, gap-toothed grin, spinning-gear backpack
  makeChar('tinker', (c) => {
    shadow(c, 32, 59, 16, 5);
    // brass backpack + gear + antenna
    c.fillStyle = '#c28a30'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(38, 32, 15, 18, 4); c.fill(); c.stroke();
    c.save(); c.translate(45.5, 41); c.rotate(STEP * 0.5);
    c.fillStyle = '#ffd27a'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.lineTo(Math.cos(a) * (i % 2 ? 4 : 6), Math.sin(a) * (i % 2 ? 4 : 6)); } c.closePath(); c.fill(); c.lineWidth = 1.2; c.stroke(); c.restore();
    c.strokeStyle = '#666'; c.lineWidth = 2; c.beginPath(); c.moveTo(48, 32); c.lineTo(50, 18); c.stroke();
    glowDot(c, 50, 17, 7, 'rgba(120,255,200,0.95)');
    boots(c, 30, '#4a3524', '#7a4a22');
    // overalls
    poly(c, [[19, 51], [20, 34], [42, 34], [43, 51]], '#3f7a8a', OUT, 2.5);
    c.fillStyle = '#e8d6a8'; c.beginPath(); c.roundRect(24, 34, 14, 9, 3); c.fill(); c.stroke();
    circle(c, 31, 40, 1.6, '#c28a30');
    // head
    circle(c, 30, 22, 13.5, '#f0c9a0', OUT, 2.5);
    poly(c, [[16, 18], [14, 8], [21, 12], [22, 2], [28, 9], [32, 0], [35, 9], [41, 3], [41, 12], [47, 10], [44, 20], [30, 12]], '#e8702a', OUT, 2);
    // goggles over eyes
    c.fillStyle = '#6a4a2a'; c.fillRect(16, 19, 28, 4);
    circle(c, 24, 23, 7, '#2a2a2a', OUT, 2); circle(c, 37, 23, 7, '#2a2a2a', OUT, 2);
    circle(c, 24, 23, 5, '#7ef0ff'); circle(c, 37, 23, 5, '#7ef0ff');
    circle(c, 25, 24, 2.3, '#10202a'); circle(c, 38, 24, 2.3, '#10202a');
    circle(c, 22.6, 21, 1.6, '#fff'); circle(c, 35.6, 21, 1.6, '#fff');
    // grin with a gap
    c.fillStyle = '#4a1a1a'; c.beginPath(); c.arc(30.5, 31, 4.6, 0.1, Math.PI - 0.1); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    c.fillStyle = '#fff'; c.fillRect(28, 28.4, 2.6, 2.6); c.fillRect(32, 28.4, 2.6, 2.6);
    // wrench
    c.save(); c.translate(11, 44); c.rotate(-0.5 + STEP * 0.2);
    c.fillStyle = '#c8ccd8'; c.beginPath(); c.roundRect(-2, -12, 4, 20, 2); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.arc(0, -13, 5, 0.5, TAU - 0.5); c.stroke(); c.restore();
  });
  // Grahm — Blood Reaver: huge pauldrons, horned helm, toothy war-grin, crescent axe over the shoulder
  makeChar('reaver', (c) => {
    shadow(c, 32, 59, 19, 5);
    // axe behind
    c.strokeStyle = '#4a3020'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(50, 56); c.lineTo(54 + STEP, 8); c.stroke();
    c.beginPath(); c.moveTo(54 + STEP, 6); c.quadraticCurveTo(68, 16, 58, 32); c.quadraticCurveTo(61, 20, 53 + STEP, 17); c.closePath();
    c.fillStyle = '#e4e4ee'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    boots(c, 32, '#3a1616', '#24100e');
    poly(c, [[16, 51], [18, 33], [46, 33], [48, 51]], '#8e1c24', OUT, 2.5);
    poly(c, [[25, 51], [27, 36], [37, 36], [39, 51]], '#c43a44');
    c.fillStyle = '#3a2a2a'; c.fillRect(17, 45, 30, 4); circle(c, 32, 47, 3, '#d8b040', OUT, 1.5);
    // pauldrons
    for (const x of [14, 50]) { circle(c, x, 33, 8, '#6a6a78', OUT, 2.5); circle(c, x - 1.5, 31, 3, '#9a9aaa'); poly(c, [[x - 3, 26], [x, 17], [x + 3, 26]], '#d8d0b8', OUT, 1.5); }
    // helm
    c.fillStyle = '#6a6a78'; c.beginPath(); c.roundRect(17, 6, 30, 28, 11); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    poly(c, [[19, 14], [6, 0], [10, 17]], '#efe4c8', OUT, 2); poly(c, [[45, 14], [58, 0], [54, 17]], '#efe4c8', OUT, 2);
    c.fillStyle = '#1a0c0c'; c.beginPath(); c.roundRect(21, 15, 22, 11, 4); c.fill();
    // angry brows + glowing eyes + teeth
    c.strokeStyle = '#1a0c0c'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, 13); c.lineTo(30, 17); c.moveTo(42, 13); c.lineTo(34, 17); c.stroke();
    ellipse(c, 27, 21, 2.8, 2.4, '#ff3a2a'); ellipse(c, 37, 21, 2.8, 2.4, '#ff3a2a');
    circle(c, 26.4, 20.4, 0.9, '#fff'); circle(c, 36.4, 20.4, 0.9, '#fff');
    c.fillStyle = '#f4f0e0'; c.beginPath(); c.roundRect(24, 28, 16, 5, 2); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 1; c.beginPath(); for (let x = 27; x < 40; x += 3.2) { c.moveTo(x, 28); c.lineTo(x, 33); } c.stroke();
  });
  // Brannoc — The Bellwright: round, jolly, braided copper beard, great bronze bell on his back, big hammer
  makeChar('bellwright', (c) => {
    shadow(c, 32, 59, 20, 5);
    // bell behind, swings with the stride
    c.save(); c.translate(44, 26); c.rotate(STEP * 0.1);
    c.beginPath(); c.moveTo(-9, -12); c.quadraticCurveTo(-11, 6, -16, 13); c.lineTo(16, 13); c.quadraticCurveTo(11, 6, 9, -12); c.quadraticCurveTo(0, -19, -9, -12);
    c.fillStyle = lin(c, -16, 0, 16, 0, [[0, '#7a4a18'], [0.45, '#f0b850'], [1, '#6a3a10']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#ffd27a'; c.fillRect(-15, 9, 30, 3);
    circle(c, 0, 16, 3.2, '#4a2a0a', OUT, 1.5);
    c.restore();
    boots(c, 30, '#3a2a1e', '#2a1c12');
    // barrel body + apron
    c.fillStyle = '#6a5446'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(15, 31, 32, 21, 9); c.fill(); c.stroke();
    poly(c, [[20, 34], [42, 34], [40, 52], [22, 52]], '#8a5a30');
    c.fillStyle = '#d4a050'; c.fillRect(20, 41, 22, 3);
    // head: broad, bushy brows, big copper beard
    circle(c, 31, 20, 14.5, '#eec4a0', OUT, 2.5);
    c.fillStyle = '#3a2a22'; c.beginPath(); c.roundRect(16, 5, 30, 8, 4); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(17, 24); c.quadraticCurveTo(14, 42, 31, 46); c.quadraticCurveTo(48, 42, 45, 24); c.quadraticCurveTo(31, 33, 17, 24);
    c.fillStyle = '#d0702a'; c.fill(); c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = '#9a4a16'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(25, 33); c.lineTo(25, 42); c.moveTo(31, 34); c.lineTo(31, 44); c.moveTo(37, 33); c.lineTo(37, 42); c.stroke();
    c.strokeStyle = '#c0601c'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(22, 15); c.lineTo(29, 17); c.moveTo(40, 15); c.lineTo(33, 17); c.stroke();
    bigEye(c, 26, 20, '#ffcf6a', 3, 3.8); bigEye(c, 36, 20, '#ffcf6a', 3, 3.8);
    ellipse(c, 31, 24.5, 3, 2.3, '#e09a78', OUT, 1.4); smile(c, 31, 26.5, 4);
    // hammer
    c.strokeStyle = '#4a3020'; c.lineWidth = 3.5; c.beginPath(); c.moveTo(13, 49); c.lineTo(9, 32); c.stroke();
    c.fillStyle = '#a8aebe'; c.beginPath(); c.roundRect(2, 26, 15, 9, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  });
  // Lune — Moon Dancer: violet ponytail, moon circlet, a cheeky wink, long fluttering scarf, poised stance
  makeChar('dancer', (c) => {
    shadow(c, 32, 59, 15, 5);
    // ponytail + scarf trail behind
    c.fillStyle = '#7a4ae0'; c.strokeStyle = OUT; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(44, 10); c.bezierCurveTo(60, 8 + STEP * 2, 60, 30, 52, 38 - STEP * 3); c.bezierCurveTo(54, 26, 52, 18, 44, 18); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#d28aff';
    c.beginPath(); c.moveTo(24, 36); c.quadraticCurveTo(8, 36 - STEP * 2, 2, 50 + STEP * 2); c.lineTo(8, 54 + STEP * 2); c.quadraticCurveTo(14, 44, 26, 42); c.closePath(); c.fill(); c.stroke();
    boots(c, 32, '#2b2244', '#c9a0ff');
    poly(c, [[22, 51], [24, 33], [40, 33], [42, 51]], '#4a3a8e', OUT, 2.5);
    poly(c, [[28, 51], [29, 36], [35, 36], [36, 51]], '#f0eaff');
    c.fillStyle = '#e8b8ff'; c.beginPath(); c.roundRect(23, 33, 18, 5, 2.5); c.fill(); c.stroke();
    // head
    circle(c, 32, 21, 13, '#f6dcc8', OUT, 2.5);
    c.fillStyle = '#7a4ae0'; c.beginPath(); c.moveTo(18, 22); c.bezierCurveTo(16, 4, 48, 4, 46, 22); c.quadraticCurveTo(42, 12, 36, 14); c.lineTo(32, 9); c.lineTo(28, 15); c.quadraticCurveTo(22, 12, 18, 22);
    c.fill(); c.lineWidth = 2.5; c.stroke();
    // winking eye + open eye
    bigEye(c, 37, 23, '#c070ff', 3.4, 4.4);
    c.strokeStyle = OUT; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.arc(27, 23, 3.2, 0.15, Math.PI - 0.15, true); c.stroke();
    blush(c, 22, 28); blush(c, 42, 28);
    c.fillStyle = '#c04a6a'; c.beginPath(); c.arc(33, 28.4, 3, 0.1, Math.PI - 0.1); c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke();
    // moon circlet
    glowDot(c, 32, 9, 8, 'rgba(225,215,255,0.9)');
    c.fillStyle = '#fff'; c.beginPath(); c.arc(32, 9, 4.6, 0, TAU); c.fill();
    c.fillStyle = '#7a4ae0'; c.beginPath(); c.arc(33.8, 8, 3.8, 0, TAU); c.fill();
    // glaive
    c.strokeStyle = '#d8d0ff'; c.lineWidth = 2.4; c.beginPath(); c.arc(12, 44, 7, -1.2, 1.6 + STEP * 0.2); c.stroke();
  });
}

// ---------- enemies ----------
function drawEnemies() {
  // Gloomling — oily shadow blob with glowing eyes
  for (const f of [0, 1]) make('gloomling' + f, 40, 40, (c) => {
    shadow(c, 20, 35, 14, 4);
    const sq = f ? 1.08 : 1, st = f ? 0.92 : 1;
    c.save(); c.translate(20, 34); c.scale(sq, st);
    c.beginPath(); c.moveTo(-14, 0);
    c.bezierCurveTo(-16, -18, -8, -26, 0, -26); c.bezierCurveTo(8, -26, 16, -18, 14, 0);
    c.quadraticCurveTo(10, -3, 7, 0); c.quadraticCurveTo(3, -4, 0, 0); c.quadraticCurveTo(-3, -4, -7, 0); c.quadraticCurveTo(-10, -3, -14, 0);
    c.fillStyle = lin(c, 0, -26, 0, 0, [[0, '#5b3a8a'], [1, '#24143d']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, -4, -19, 4, 2.5, 'rgba(255,255,255,0.18)');
    c.restore();
    eye(c, 15, 22 + f, 2.3, '#5ff8ff'); eye(c, 25, 22 + f, 2.3, '#5ff8ff');
  });
  // Dusk Moth — fast, fluttering
  for (const f of [0, 1]) make('moth' + f, 40, 40, (c) => {
    shadow(c, 20, 36, 10, 3);
    c.save(); c.translate(20, 19);
    const wy = f ? 0.55 : 1;
    for (const s of [-1, 1]) {
      c.save(); c.scale(s, wy);
      c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(18, -20, 19, -4); c.quadraticCurveTo(16, 6, 0, 3);
      c.fillStyle = '#7a3a5e'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
      circle(c, 11, -6, 3, '#ff9ad0');
      c.beginPath(); c.moveTo(0, 3); c.quadraticCurveTo(13, 6, 12, 15); c.quadraticCurveTo(5, 12, 0, 5);
      c.fillStyle = '#5a2846'; c.fill(); c.stroke();
      c.restore();
    }
    ellipse(c, 0, 0, 4, 9, '#2a1424', OUT, 2);
    eye(c, -2, -5, 1.4, '#ffd060'); eye(c, 2, -5, 1.4, '#ffd060');
    c.restore();
  });
  // Husk — lumbering stone hulk with ember cracks
  for (const f of [0, 1]) make('husk' + f, 60, 60, (c) => {
    shadow(c, 30, 54, 22, 6);
    const lift = f ? -2 : 0;
    c.fillStyle = '#4a4040'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(15, 44 + lift, 10, 11, 3); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(35, 44 - lift, 10, 11, 3); c.fill(); c.stroke();
    poly(c, [[10, 44], [8, 22], [18, 10], [42, 10], [52, 22], [50, 44]], '#6a5a52', OUT, 3);
    poly(c, [[14, 40], [13, 24], [20, 15], [40, 15], [46, 24], [46, 40]], '#7d6b60');
    c.strokeStyle = '#ff6a20'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(20, 30); c.lineTo(26, 36); c.lineTo(24, 42); c.moveTo(38, 22); c.lineTo(34, 30); c.lineTo(40, 36); c.stroke();
    c.fillStyle = '#6a5a52'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(3, 22 - lift, 10, 20, 4); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(47, 22 + lift, 10, 20, 4); c.fill(); c.stroke();
    c.fillStyle = '#140c0c'; c.fillRect(21, 19, 18, 6);
    eye(c, 26, 22, 2, '#ff5a20'); eye(c, 34, 22, 2, '#ff5a20');
  });
  // Wraith — hooded spirit trailing a ragged tail
  for (const f of [0, 1]) make('wraith' + f, 48, 52, (c) => {
    c.save(); c.translate(24, 0);
    const w = f ? 3 : -3;
    c.beginPath(); c.moveTo(-14, 20); c.quadraticCurveTo(-16, 4, 0, 3); c.quadraticCurveTo(16, 4, 14, 20);
    c.lineTo(12, 38); c.lineTo(6 + w, 34); c.lineTo(2, 48); c.lineTo(-3 + w, 36); c.lineTo(-9, 44); c.lineTo(-12, 34);
    c.closePath();
    c.fillStyle = lin(c, 0, 3, 0, 48, [[0, 'rgba(90,200,190,0.95)'], [1, 'rgba(30,80,90,0.25)']]); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(10,30,40,0.9)'; c.stroke();
    ellipse(c, 0, 16, 9, 8, '#071a1e');
    eye(c, -4, 16, 1.8, '#d0fff4'); eye(c, 4, 16, 1.8, '#d0fff4');
    c.restore();
  });
  // Bloater (splitter) — pustule sac that bursts into broodlings
  make('splitter0', 48, 48, (c) => {
    shadow(c, 24, 43, 16, 4);
    circle(c, 24, 25, 17, lin(c, 0, 8, 0, 42, [[0, '#9ad04a'], [1, '#3a6a1a']]), OUT, 2.5);
    circle(c, 15, 18, 5, '#c6f07a', OUT, 1.5); circle(c, 32, 31, 4, '#c6f07a', OUT, 1.5); circle(c, 30, 15, 3, '#c6f07a', OUT, 1.5);
    eye(c, 20, 26, 2.4, '#ff3a6a'); eye(c, 28, 24, 1.8, '#ff3a6a');
  });
  make('splitter1', 48, 48, (c) => {
    shadow(c, 24, 43, 17, 4);
    ellipse(c, 24, 26, 18, 16, lin(c, 0, 8, 0, 42, [[0, '#9ad04a'], [1, '#3a6a1a']]), OUT, 2.5);
    circle(c, 15, 19, 5.5, '#c6f07a', OUT, 1.5); circle(c, 32, 32, 4.5, '#c6f07a', OUT, 1.5); circle(c, 30, 16, 3.2, '#c6f07a', OUT, 1.5);
    eye(c, 20, 27, 2.4, '#ff3a6a'); eye(c, 28, 25, 1.8, '#ff3a6a');
  });
  for (const f of [0, 1]) make('broodling' + f, 24, 24, (c) => {
    shadow(c, 12, 21, 8, 2.5);
    c.strokeStyle = OUT; c.lineWidth = 1.5;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(12, 14); c.lineTo(12 + s * 10, 12 + (f ? 6 : 2)); c.stroke(); }
    circle(c, 12, 13, 7, '#7ab83a', OUT, 2);
    eye(c, 10, 12, 1.4, '#ff3a6a'); eye(c, 14, 12, 1.4, '#ff3a6a');
  });
  // Ram Beetle (charger)
  for (const f of [0, 1]) make('beetle' + f, 52, 48, (c) => {
    shadow(c, 26, 43, 19, 5);
    c.strokeStyle = OUT; c.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
      c.beginPath(); c.moveTo(26 + s * 8, 26 + i * 6); c.lineTo(26 + s * 19, 30 + i * 6 + ((i + f) % 2 ? 3 : -2)); c.stroke();
    }
    ellipse(c, 26, 28, 15, 14, lin(c, 0, 14, 0, 42, [[0, '#a8384a'], [1, '#4a1020']]), OUT, 2.5);
    c.beginPath(); c.moveTo(26, 14); c.lineTo(26, 42); c.stroke();
    poly(c, [[20, 16], [26, 0], [32, 16]], '#e8d8b0', OUT, 2);
    ellipse(c, 21, 22, 3, 5, 'rgba(255,255,255,0.25)');
    eye(c, 21, 15, 1.6, '#ffe040'); eye(c, 31, 15, 1.6, '#ffe040');
  });
  // Spitter — bloated toad that lobs venom orbs
  for (const f of [0, 1]) make('spitter' + f, 46, 44, (c) => {
    shadow(c, 23, 39, 17, 4);
    ellipse(c, 23, 27, 17, 13 - f, lin(c, 0, 14, 0, 40, [[0, '#4ab8a0'], [1, '#14524a']]), OUT, 2.5);
    ellipse(c, 23, 31, 10, 6, '#bff0d0');
    ellipse(c, 23, 30 + f, 6, 2 + f * 3, '#3a0a2a');
    circle(c, 14, 16, 5.5, '#4ab8a0', OUT, 2); circle(c, 32, 16, 5.5, '#4ab8a0', OUT, 2);
    eye(c, 14, 16, 2.4, '#ff8a20'); eye(c, 32, 16, 2.4, '#ff8a20');
  });
  // Sentinel — floating spiked eye (late-game elite fodder)
  for (const f of [0, 1]) make('sentinel' + f, 64, 64, (c) => {
    shadow(c, 32, 60, 14, 4);
    c.save(); c.translate(32, 28); c.rotate(f ? 0.2 : 0);
    poly(c, star(0, 0, 27, 15, 8), '#3a2a5a', OUT, 2.5);
    c.restore();
    circle(c, 32, 28, 16, radial(c, 32, 28, 16, [[0, '#fff'], [0.4, '#f0e0ff'], [1, '#9070c0']]), OUT, 2.5);
    circle(c, 32, 28, 8, '#ff2a5a'); circle(c, 32, 28, 4, '#140008'); circle(c, 29, 25, 2, '#fff');
  });
  // ---- Bosses ----
  // Brood Matron
  for (const f of [0, 1]) make('matron' + f, 150, 140, (c) => {
    shadow(c, 75, 128, 58, 12);
    c.strokeStyle = OUT; c.lineWidth = 6; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const a = 0.3 + i * 0.4 + (f && i % 2 ? 0.12 : 0);
      c.beginPath(); c.moveTo(75 + s * 25, 80);
      c.quadraticCurveTo(75 + s * (50 + i * 6), 40 + i * 14, 75 + s * (60 + Math.cos(a) * 12), 110 + i * 5);
      c.stroke();
    }
    c.strokeStyle = '#4a2a5a'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const a = 0.3 + i * 0.4 + (f && i % 2 ? 0.12 : 0);
      c.beginPath(); c.moveTo(75 + s * 25, 80);
      c.quadraticCurveTo(75 + s * (50 + i * 6), 40 + i * 14, 75 + s * (60 + Math.cos(a) * 12), 110 + i * 5);
      c.stroke();
    }
    ellipse(c, 75, 92, 40, 30, lin(c, 0, 62, 0, 122, [[0, '#8a3aa0'], [1, '#2a0a3a']]), OUT, 4);
    for (let i = 0; i < 6; i++) circle(c, 55 + i * 8, 100 + (i % 2) * 8, 4, '#d070ff', OUT, 1.5);
    circle(c, 75, 52, 26, lin(c, 0, 26, 0, 78, [[0, '#a050c0'], [1, '#4a1a6a']]), OUT, 4);
    const eyes = [[63, 46, 4], [87, 46, 4], [75, 40, 3], [68, 58, 3], [82, 58, 3], [75, 52, 5]];
    for (const [x, y, r] of eyes) eye(c, x, y, r, '#ffe050');
  });
  // Cinder Colossus
  for (const f of [0, 1]) make('colossus' + f, 190, 190, (c) => {
    shadow(c, 95, 176, 70, 14);
    const l = f ? 5 : 0;
    c.fillStyle = '#3a3036'; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.roundRect(58, 140 - l, 28, 38, 8); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(104, 140 + l - 5, 28, 38, 8); c.fill(); c.stroke();
    poly(c, [[40, 140], [30, 70], [60, 36], [130, 36], [160, 70], [150, 140]], '#4e4248', OUT, 5);
    poly(c, [[52, 132], [46, 76], [68, 48], [122, 48], [144, 76], [138, 132]], '#5e5056');
    glowDot(c, 95, 96, 34, 'rgba(255,120,30,0.95)');
    poly(c, star(95, 96, 18, 9, 6, f * 0.3), '#ffe0a0');
    c.strokeStyle = '#ff7a20'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(60, 70); c.lineTo(76, 88); c.moveTo(130, 72); c.lineTo(114, 88); c.moveTo(80, 130); c.lineTo(95, 116); c.lineTo(110, 132); c.stroke();
    c.fillStyle = '#4e4248'; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.roundRect(8, 66 + l, 30, 70, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(152, 66 - l, 30, 70, 12); c.fill(); c.stroke();
    c.beginPath(); c.roundRect(70, 8, 50, 40, 12); c.fill(); c.stroke();
    c.fillStyle = '#100808'; c.fillRect(78, 22, 34, 10);
    eye(c, 86, 27, 4, '#ff6a20'); eye(c, 104, 27, 4, '#ff6a20');
  });
  // Gloam Herald — gaunt shadow in a tattered cloak, crown of three pale eye-lights, black banner
  for (const f of [0, 1]) make('herald' + f, 90, 120, (c) => {
    shadow(c, 45, 112, 26, 6);
    // banner pole + tattered black banner
    c.strokeStyle = '#2a2230'; c.lineWidth = 3; c.beginPath(); c.moveTo(70, 112); c.lineTo(70, 10); c.stroke();
    c.beginPath(); c.moveTo(70, 14); c.lineTo(88 - f * 3, 18); c.lineTo(84 - f * 2, 34); c.lineTo(88, 40 + f * 2); c.lineTo(72, 44); c.closePath();
    c.fillStyle = '#0c0812'; c.fill(); c.strokeStyle = '#5a4a6a'; c.lineWidth = 1.5; c.stroke();
    circle(c, 79, 28, 3, null, '#b8a8ff', 1.2);
    // cloak body: tall tapered shape with ragged hem
    c.beginPath(); c.moveTo(45, 22);
    c.bezierCurveTo(62, 30, 64, 70, 62, 104);
    c.lineTo(56, 98); c.lineTo(52, 108); c.lineTo(46, 99); c.lineTo(40, 110); c.lineTo(35, 99); c.lineTo(29, 106); c.lineTo(28, 96);
    c.bezierCurveTo(26, 70, 28, 30, 45, 22);
    c.fillStyle = lin(c, 0, 22, 0, 108, [[0, '#2a2038'], [1, '#08060c']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    // arm holding pole
    c.strokeStyle = '#1a1424'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(55, 44); c.lineTo(68, 50 + f); c.stroke();
    // hood with void face
    c.beginPath(); c.moveTo(45, 6); c.bezierCurveTo(60, 12, 58, 34, 45, 38); c.bezierCurveTo(32, 34, 30, 12, 45, 6);
    c.fillStyle = '#1a1424'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2.5; c.stroke();
    ellipse(c, 45, 25, 8, 9, '#020104');
    // crown of three pale eye-lights
    for (const [x, y] of [[37, 9], [45, 4], [53, 9]]) glowDot(c, x, y, 6, 'rgba(200,190,255,0.85)');
    eye(c, 41, 25, 1.6, '#c8c0ff'); eye(c, 49, 25, 1.6, '#c8c0ff');
  });
  // Eclipse Tyrant — a black sun wearing a crown of corona
  for (const f of [0, 1]) make('tyrant' + f, 220, 220, (c) => {
    c.save(); c.translate(110, 105);
    c.fillStyle = radial(c, 0, 0, 108, [[0, 'rgba(255,240,200,0)'], [0.55, 'rgba(255,170,60,0.0)'], [0.62, 'rgba(255,190,90,0.9)'], [0.8, 'rgba(255,90,30,0.35)'], [1, 'rgba(120,0,60,0)']]);
    c.beginPath(); c.arc(0, 0, 108, 0, TAU); c.fill();
    c.rotate(f * 0.15);
    poly(c, star(0, 0, 100, 64, 14), 'rgba(255,140,40,0.55)');
    c.rotate(-f * 0.3);
    poly(c, star(0, 0, 86, 62, 10, 0.3), 'rgba(255,220,120,0.6)');
    c.rotate(f * 0.15);
    circle(c, 0, 0, 62, radial(c, -12, -12, 70, [[0, '#2a1438'], [1, '#05010a']]), '#ffb060', 4);
    // crown
    poly(c, [[-36, -50], [-30, -84], [-14, -62], [0, -96], [14, -62], [30, -84], [36, -50]], '#1a0a24', '#ffcf6a', 3);
    for (const x of [-30, 0, 30]) circle(c, x, x ? -84 : -96, 4, '#ff3a6a');
    eye(c, -22, -6, 7, '#ff3a6a'); eye(c, 22, -6, 7, '#ff3a6a');
    c.strokeStyle = '#ff3a6a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 18, 20, 0.2, Math.PI - 0.2); c.stroke();
    c.restore();
  });
  // Cinder Imp — squat ember-bodied imp with a flame tuft (Ashfields)
  for (const f of [0, 1]) make('imp' + f, 40, 42, (c) => {
    shadow(c, 20, 38, 11, 3.5);
    const hop = f ? -2 : 0;
    c.save(); c.translate(0, hop);
    // flame tuft
    c.fillStyle = radial(c, 20, 10, 12, [[0, '#fff2a0'], [0.4, '#ffb030'], [1, 'rgba(255,80,0,0)']]);
    c.beginPath(); c.moveTo(14, 16); c.quadraticCurveTo(13 + f * 2, 4, 20, 1); c.quadraticCurveTo(26 - f * 2, 6, 26, 16); c.fill();
    // horns
    poly(c, [[12, 15], [8, 6], [15, 12]], '#2a1410', OUT, 1.5);
    poly(c, [[28, 15], [32, 6], [25, 12]], '#2a1410', OUT, 1.5);
    // body
    c.beginPath(); c.ellipse(20, 25, 11, 11, 0, 0, TAU);
    c.fillStyle = radial(c, 17, 21, 14, [[0, '#ff9a40'], [0.6, '#c43a10'], [1, '#5a1406']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    // ember cracks
    c.strokeStyle = '#ffd060'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(14, 30); c.lineTo(17, 27); c.lineTo(15, 24); c.moveTo(26, 29); c.lineTo(23, 27); c.stroke();
    // stubby arms
    ellipse(c, 8, 27 + (f ? -2 : 1), 3, 4, '#a8300c', OUT, 1.5);
    ellipse(c, 32, 27 + (f ? 1 : -2), 3, 4, '#a8300c', OUT, 1.5);
    eye(c, 16, 23, 1.8, '#fff060'); eye(c, 24, 23, 1.8, '#fff060');
    c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.arc(20, 28, 3.5, 0.3, Math.PI - 0.3); c.stroke();
    c.restore();
  });
  // Frost Wisp — drifting pale flame of ice with orbiting crystal shards (Rimewood)
  for (const f of [0, 1]) make('frostwisp' + f, 44, 48, (c) => {
    shadow(c, 22, 44, 9, 3);
    glowDot(c, 22, 22, 20, 'rgba(140,220,255,0.45)');
    c.save(); c.translate(22, 24);
    c.beginPath(); c.moveTo(0, -20 + f * 2);
    c.bezierCurveTo(10, -10, 12, 4, 6, 11); c.quadraticCurveTo(0, 15, -6, 11);
    c.bezierCurveTo(-12, 4, -10, -10, 0, -20 + f * 2);
    c.fillStyle = lin(c, 0, -20, 0, 14, [[0, 'rgba(235,250,255,0.95)'], [0.5, 'rgba(150,215,255,0.9)'], [1, 'rgba(60,120,190,0.85)']]); c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(15,40,70,0.9)'; c.stroke();
    ellipse(c, 0, 2, 6, 7, 'rgba(10,30,60,0.85)');
    eye(c, -2.5, 1, 1.5, '#e0f8ff'); eye(c, 2.5, 1, 1.5, '#e0f8ff');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + f * 0.5;
      const x = Math.cos(a) * 15, y = Math.sin(a) * 9 + 4;
      poly(c, [[x, y - 4], [x + 2.5, y], [x, y + 4], [x - 2.5, y]], '#e8faff', '#3a7aa8', 1);
    }
    c.restore();
  });
  // Mire Lurker — bog creature: mossy hump with lantern-eyes (Drowned Marsh). Frame 0 surfaced, frame 1 mid-sink
  for (const f of [0, 1]) make('lurker' + f, 48, 40, (c) => {
    c.fillStyle = 'rgba(40,70,60,0.5)'; c.beginPath(); c.ellipse(24, 33, 20, 5, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(160,220,200,0.45)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(24, 33, 21, 6, 0, 0, TAU); c.stroke();
    const top = f ? 20 : 8;
    c.beginPath(); c.moveTo(6, 33); c.bezierCurveTo(6, top, 42, top, 42, 33); c.closePath();
    c.fillStyle = lin(c, 0, top, 0, 33, [[0, '#4a6a3a'], [1, '#1e3024']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    for (const [x, y] of [[15, top + 8], [30, top + 6], [23, top + 3]]) circle(c, x, y, 2.4, '#7a9a4a');
    c.strokeStyle = '#2a4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(12, top + 10); c.quadraticCurveTo(10, top + 16, 13, 30); c.stroke();
    if (!f) { eye(c, 18, top + 12, 2.2, '#d0ff60'); eye(c, 30, top + 12, 2.2, '#d0ff60'); }
    else { eye(c, 19, top + 9, 1.6, '#d0ff60'); eye(c, 29, top + 9, 1.6, '#d0ff60'); }
  });
  // Gloom Totem — breakable crystal obelisk that holds loot
  make('totem', 40, 60, (c) => {
    shadow(c, 20, 54, 15, 4);
    glowDot(c, 20, 28, 20, 'rgba(255,190,90,0.45)');
    poly(c, [[20, 2], [32, 20], [27, 52], [13, 52], [8, 20]], '#3a2a5a', OUT, 2.5);
    poly(c, [[20, 8], [27, 21], [20, 44], [13, 21]], '#ffcf6a');
    poly(c, [[20, 8], [27, 21], [20, 26]], '#fff2c4');
  });
  // The Hollow — a drifting shroud around a pale, weeping mask; nothing behind the eyes
  for (const f of [0, 1]) make('hollow' + f, 110, 120, (c) => {
    shadow(c, 55, 112, 30, 6);
    glowDot(c, 55, 56, 52, 'rgba(110,60,200,0.35)');
    c.beginPath(); c.moveTo(55, 10);
    c.bezierCurveTo(88, 14, 96, 60, 90, 98);
    for (let i = 0; i < 6; i++) { const x = 90 - i * 14.5; c.lineTo(x - 7, 100 + ((i + f) % 2) * 12); c.lineTo(x - 14.5, 96 + ((i + f) % 2) * -4); }
    c.bezierCurveTo(14, 60, 22, 14, 55, 10);
    c.fillStyle = lin(c, 0, 10, 0, 110, [[0, '#2a1a4a'], [1, '#05030a']]); c.fill();
    c.lineWidth = 2.5; c.strokeStyle = '#8a6ae0'; c.stroke();
    // bone-white mask
    c.beginPath(); c.moveTo(55, 18); c.bezierCurveTo(78, 20, 80, 44, 72, 64); c.quadraticCurveTo(55, 80, 38, 64); c.bezierCurveTo(30, 44, 32, 20, 55, 18);
    c.fillStyle = '#e8e4f4'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    ellipse(c, 45, 42, 5, 9, '#05030a'); ellipse(c, 65, 42, 5, 9, '#05030a');
    c.strokeStyle = '#6a4ac0'; c.lineWidth = 2; c.beginPath(); c.moveTo(45, 50); c.lineTo(44, 66 + f * 3); c.moveTo(65, 50); c.lineTo(66, 66 + f * 3); c.stroke();
    ellipse(c, 55, 66, 4, 6 + f, '#05030a');
    eye(c, 45, 42, 2, '#c8a8ff'); eye(c, 65, 42, 2, '#c8a8ff');
  });
  // White flash variants
  for (const n of ['gloomling0', 'gloomling1', 'moth0', 'moth1', 'husk0', 'husk1', 'wraith0', 'wraith1',
    'splitter0', 'splitter1', 'broodling0', 'broodling1', 'beetle0', 'beetle1', 'spitter0', 'spitter1',
    'sentinel0', 'sentinel1', 'matron0', 'matron1', 'colossus0', 'colossus1', 'tyrant0', 'tyrant1', 'totem', 'herald0', 'herald1',
    'imp0', 'imp1', 'frostwisp0', 'frostwisp1', 'lurker0', 'lurker1']) makeWhite(n);
}

// ---------- decor ----------
function drawDecor() {
  // ---- Ashfields props ----
  make('stump', 40, 44, (c) => {
    shadow(c, 20, 39, 16, 4);
    poly(c, [[8, 38], [10, 18], [14, 14], [26, 14], [30, 18], [32, 38]], '#2a1c16', OUT, 2.5);
    c.strokeStyle = '#140c0a'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(15, 18); c.lineTo(14, 36); c.moveTo(22, 17); c.lineTo(23, 37); c.stroke();
    ellipse(c, 20, 15, 10, 3.5, '#4a3020', OUT, 2);
    c.strokeStyle = '#ff7a20'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(11, 28); c.lineTo(14, 25); c.moveTo(27, 32); c.lineTo(29, 27); c.stroke();
    poly(c, [[28, 20], [36, 8], [31, 19]], '#2a1c16', OUT, 1.5);
  });
  make('vent', 40, 26, (c) => {
    glowDot(c, 20, 13, 16, 'rgba(255,110,30,0.6)');
    ellipse(c, 20, 14, 15, 7, '#2a1a14', OUT, 2);
    ellipse(c, 20, 14, 9, 4, radial(c, 20, 14, 9, [[0, '#fff0a0'], [0.4, '#ff8a20'], [1, '#6a1a04']]));
    for (const [x, y] of [[9, 9], [31, 10], [14, 20]]) circle(c, x, y, 1.6, '#ffb040');
  });
  make('basalt', 34, 30, (c) => {
    shadow(c, 17, 26, 15, 4);
    poly(c, [[4, 26], [6, 12], [12, 6], [22, 8], [30, 14], [30, 26]], '#30282a', OUT, 2);
    poly(c, [[12, 6], [22, 8], [18, 14], [10, 12]], '#463a3a');
    c.strokeStyle = '#ff6a20'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(9, 20); c.lineTo(15, 17); c.lineTo(20, 22); c.stroke();
  });
  // ---- Rimewood props ----
  make('pine', 44, 70, (c) => {
    shadow(c, 22, 64, 16, 5);
    c.fillStyle = '#3a2a22'; c.fillRect(19, 52, 6, 12);
    for (let i = 0; i < 3; i++) {
      const y = 14 + i * 14, w = 10 + i * 6;
      poly(c, [[22, y - 12], [22 + w, y + 10], [22 - w, y + 10]], '#1e3a40', OUT, 2);
      poly(c, [[22, y - 12], [22 + w * 0.55, y + 2], [22 - w * 0.6, y + 3]], '#e8f6ff');
    }
  });
  make('icecluster', 36, 34, (c) => {
    shadow(c, 18, 30, 14, 3.5);
    glowDot(c, 18, 18, 16, 'rgba(140,220,255,0.35)');
    for (const [x, h, w] of [[11, 18, 4], [19, 26, 5], [26, 14, 4]]) {
      poly(c, [[x, 30 - h], [x + w, 30 - h * 0.35], [x + w * 0.4, 30], [x - w * 0.6, 30], [x - w, 30 - h * 0.35]], '#bfeaff', '#2a6a9a', 1.5);
      poly(c, [[x, 30 - h], [x + w, 30 - h * 0.35], [x, 30 - h * 0.3]], '#f4fcff');
    }
  });
  make('snowrock', 36, 28, (c) => {
    shadow(c, 18, 24, 16, 4);
    poly(c, [[4, 22], [8, 10], [18, 4], [30, 9], [33, 22]], '#3a4658', OUT, 2);
    c.beginPath(); c.moveTo(7, 12); c.quadraticCurveTo(18, 1, 31, 10); c.quadraticCurveTo(20, 9, 7, 12);
    c.fillStyle = '#eef8ff'; c.fill();
  });
  // ---- Drowned Marsh props ----
  make('reeds', 30, 40, (c) => {
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 3.6, h = 18 + ((i * 7) % 13);
      c.strokeStyle = i % 2 ? '#3a5a34' : '#2e4a2c'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, 38); c.quadraticCurveTo(x + (i % 3 - 1) * 4, 38 - h * 0.6, x + (i % 3 - 1) * 5, 38 - h); c.stroke();
      if (i % 2 === 0) ellipse(c, x + (i % 3 - 1) * 5, 38 - h + 3, 1.8, 4.5, '#5a3a24', OUT, 1);
    }
  });
  make('lilypad', 34, 20, (c) => {
    c.beginPath(); c.ellipse(17, 10, 15, 8, 0, 0.35, TAU - 0.15); c.lineTo(17, 10); c.closePath();
    c.fillStyle = '#2e5a3a'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = '#4a7a50'; c.lineWidth = 1; c.beginPath(); c.moveTo(17, 10); c.lineTo(6, 8); c.moveTo(17, 10); c.lineTo(22, 16); c.stroke();
    glowDot(c, 24, 8, 6, 'rgba(255,200,230,0.5)');
    for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; circle(c, 24 + Math.cos(a) * 2.6, 8 + Math.sin(a) * 2.6, 2, '#ffd6ea'); }
    circle(c, 24, 8, 1.4, '#fff2a0');
  });
  make('sunklantern', 30, 40, (c) => {
    c.fillStyle = 'rgba(40,70,60,0.45)'; c.beginPath(); c.ellipse(15, 34, 13, 4, 0, 0, TAU); c.fill();
    glowDot(c, 15, 18, 14, 'rgba(200,255,120,0.5)');
    c.save(); c.translate(15, 22); c.rotate(-0.25);
    c.fillStyle = '#3a3a30'; c.strokeStyle = OUT; c.lineWidth = 2;
    c.beginPath(); c.roundRect(-6, -10, 12, 16, 2); c.fill(); c.stroke();
    c.fillStyle = 'rgba(210,255,140,0.85)'; c.fillRect(-4, -7, 8, 9);
    c.beginPath(); c.moveTo(-5, -10); c.lineTo(0, -15); c.lineTo(5, -10); c.stroke();
    c.restore();
  });
  make('rock0', 36, 28, (c) => {
    shadow(c, 18, 24, 16, 4);
    poly(c, [[4, 22], [8, 10], [18, 4], [30, 9], [33, 22]], '#3a3a4e', OUT, 2);
    poly(c, [[9, 12], [18, 6], [27, 10], [20, 14]], '#52526a');
  });
  make('rock1', 24, 20, (c) => {
    shadow(c, 12, 17, 10, 3);
    poly(c, [[3, 16], [6, 7], [14, 3], [21, 8], [21, 16]], '#34344a', OUT, 2);
  });
  make('grass', 28, 22, (c) => {
    c.strokeStyle = '#2f5a4a'; c.lineWidth = 2; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = 5 + i * 3;
      c.beginPath(); c.moveTo(x, 20); c.quadraticCurveTo(x + (rnd() - 0.5) * 8, 10, x + (rnd() - 0.5) * 10, 3 + rnd() * 6); c.stroke();
    }
  });
  make('shroom', 24, 24, (c) => {
    glowDot(c, 12, 10, 12, 'rgba(90,255,220,0.5)');
    c.fillStyle = '#c8e8e0'; c.fillRect(10, 11, 4, 10);
    c.beginPath(); c.arc(12, 11, 8, Math.PI, 0); c.fillStyle = '#3affd0'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke();
    circle(c, 9, 8, 1.4, '#e0fff8'); circle(c, 15, 7, 1.1, '#e0fff8');
  });
  make('bones', 32, 20, (c) => {
    c.strokeStyle = '#cfc6b0'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(4, 15); c.lineTo(22, 6); c.moveTo(10, 4); c.lineTo(26, 16); c.stroke();
    circle(c, 25, 11, 5, '#ddd4be', OUT, 1.5);
    circle(c, 23.5, 10, 1.2, OUT); circle(c, 26.5, 10, 1.2, OUT);
  });
  make('pillar', 40, 72, (c) => {
    shadow(c, 20, 66, 18, 5);
    c.fillStyle = '#3e3a56'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.roundRect(9, 18, 22, 48, 2); c.fill(); c.stroke();
    c.fillStyle = '#4e4a68'; c.fillRect(13, 20, 4, 44);
    poly(c, [[7, 18], [10, 8], [18, 12], [24, 4], [33, 18]], '#4a4664', OUT, 2.5);
    c.fillStyle = '#2f5a4a'; c.beginPath(); c.ellipse(16, 60, 9, 4, 0, 0, TAU); c.fill();
  });
  make('flower', 20, 20, (c) => {
    glowDot(c, 10, 9, 9, 'rgba(255,120,200,0.45)');
    c.strokeStyle = '#2f5a4a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(10, 19); c.lineTo(10, 10); c.stroke();
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; circle(c, 10 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, 2.6, '#ff8ad0'); }
    circle(c, 10, 8, 2, '#fff2a0');
  });
}

// ---------- digits for damage numbers ----------
function drawDigits() {
  const chars = '0123456789!';
  for (const ch of chars) {
    make('d' + ch, 18, 24, (c) => {
      c.font = '900 22px "Arial Black", Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = '#000'; c.lineJoin = 'round';
      c.strokeText(ch, 9, 13); c.fillStyle = '#fff'; c.fillText(ch, 9, 13);
    });
  }
}

// ---------- weapon/passive icons (atlas regions reused for HTML UI) ----------
function iconBG(c, col) {
  c.fillStyle = radial(c, 24, 24, 30, [[0, col], [1, '#120a1c']]);
  c.beginPath(); c.roundRect(1, 1, 46, 46, 8); c.fill();
}
function drawIcons() {
  const I = (name, col, fn) => make('icon_' + name, 48, 48, (c) => { iconBG(c, col); c.save(); fn(c); c.restore(); });
  const blit = (c, frame, x, y, s = 1, rot = 0) => {
    const f = frames[frame];
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
    c.drawImage(atlasCanvas, f.x * SS, f.y * SS, f.w * SS, f.h * SS, -f.w / 2, -f.h / 2, f.w, f.h);
    c.restore();
  };
  // weapons
  I('emberBolt', '#6a2a0a', (c) => { blit(c, 'bolt', 30, 18, 0.9); blit(c, 'bolt', 18, 30, 1.1); });
  I('haloBlades', '#0a3a5a', (c) => { blit(c, 'blade', 16, 16, 0.8, 0); blit(c, 'blade', 32, 32, 0.8, 3); c.strokeStyle = 'rgba(160,230,255,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(24, 24, 13, 0, TAU); c.stroke(); });
  I('stormCoil', '#2a2a6a', (c) => { c.strokeStyle = '#bfe0ff'; c.lineWidth = 3; c.shadowColor = '#6ab0ff'; c.shadowBlur = 8; c.beginPath(); c.moveTo(28, 6); c.lineTo(16, 24); c.lineTo(26, 24); c.lineTo(18, 42); c.stroke(); });
  I('frostPulse', '#0a3a5a', (c) => { blit(c, 'freeze', 24, 24, 1.1); c.strokeStyle = 'rgba(180,240,255,0.7)'; c.lineWidth = 2; c.beginPath(); c.arc(24, 24, 19, 0, TAU); c.stroke(); });
  I('wispSwarm', '#0a4a3a', (c) => { blit(c, 'wisp', 16, 30); blit(c, 'wisp', 30, 16); blit(c, 'wisp', 32, 32, 0.7); });
  I('crescentArc', '#5a0a1a', (c) => { blit(c, 'slash', 26, 24, 0.33); });
  I('starfall', '#5a2a0a', (c) => { blit(c, 'meteor', 22, 26, 0.9); blit(c, 'spark', 36, 12, 0.7); });
  I('moonglaive', '#2a1a5a', (c) => { blit(c, 'glaive', 24, 24, 0.85); });
  I('prismBeam', '#4a0a4a', (c) => { const cols = ['#ff6a8a', '#ffd060', '#6affc0', '#6ac0ff']; cols.forEach((col, i) => { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(8, 40 - i * 3); c.lineTo(42, 10 + i * 4); c.stroke(); }); circle(c, 10, 38, 5, '#fff'); });
  I('bloomMines', '#5a0a3a', (c) => { blit(c, 'mine', 24, 24, 1.1); });
  I('sparkDrones', '#2a3a1a', (c) => { blit(c, 'drone', 24, 24, 1.05); });
  I('sunRing', '#6a3a0a', (c) => { c.strokeStyle = '#ffcf6a'; c.lineWidth = 4; c.setLineDash([6, 4]); c.beginPath(); c.arc(24, 24, 15, 0, TAU); c.stroke(); glowDot(c, 24, 24, 10, 'rgba(255,180,60,0.9)'); });
  I('iceLance', '#0a2a4a', (c) => { blit(c, 'icicle', 24, 24, 1.3, -0.7); blit(c, 'icicle', 18, 32, 0.9, -0.7); });
  I('sanctum', '#5a4a0a', (c) => { blit(c, 'feather', 24, 18, 1); blit(c, 'feather', 22, 30, 1, 0.4); });
  I('gravewell', '#2a0a4a', (c) => { blit(c, 'vortex', 24, 24, 0.36); });
  // fusions
  I('cataclysm', '#7a1a00', (c) => { blit(c, 'meteor', 24, 24, 1.05); blit(c, 'bolt', 34, 14, 0.8); blit(c, 'bolt', 12, 34, 0.7); });
  I('thousandEdges', '#003a6a', (c) => { for (let i = 0; i < 6; i++) blit(c, 'blade', 24 + Math.cos(i) * 13, 24 + Math.sin(i) * 13, 0.55, i); });
  I('tempestHeart', '#1a2a7a', (c) => { blit(c, 'freeze', 24, 24, 1); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(34, 4); c.lineTo(26, 20); c.lineTo(34, 20); c.lineTo(24, 40); c.stroke(); });
  I('seraphChoir', '#4a0a5a', (c) => { blit(c, 'wisp', 24, 24, 1.4); c.strokeStyle = '#ffe0ff'; c.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; c.beginPath(); c.moveTo(24 + Math.cos(a) * 9, 24 + Math.sin(a) * 9); c.lineTo(24 + Math.cos(a) * 21, 24 + Math.sin(a) * 21); c.stroke(); } });
  I('eclipseDisc', '#3a0a3a', (c) => { circle(c, 24, 24, 15, '#05010a', '#ffb060', 3); blit(c, 'glaive', 24, 24, 0.6); });
  I('hiveFoundry', '#3a3a0a', (c) => { blit(c, 'drone', 30, 18, 0.9); blit(c, 'mine', 16, 32, 0.8); });
  I('glacierSpire', '#0a3a6a', (c) => { for (let i = 0; i < 5; i++) blit(c, 'icicle', 24, 24, 1, (i / 5) * TAU); });
  I('eventHorizon', '#1a0430', (c) => { blit(c, 'vortex', 24, 26, 0.34); blit(c, 'meteor', 32, 14, 0.55); blit(c, 'meteor', 13, 16, 0.4); });
  // passives
  I('might', '#6a1a0a', (c) => { glowDot(c, 24, 24, 18, 'rgba(255,90,40,0.9)'); poly(c, [[24, 10], [33, 24], [24, 38], [15, 24]], '#ffb070', OUT, 2); });
  I('haste', '#3a3a4a', (c) => { circle(c, 24, 24, 14, '#d0d8e8', OUT, 2.5); c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.moveTo(24, 24); c.lineTo(24, 14); c.moveTo(24, 24); c.lineTo(31, 28); c.stroke(); });
  I('reach', '#0a3a4a', (c) => { circle(c, 24, 24, 15, 'rgba(150,230,255,0.25)', '#bfefff', 2.5); circle(c, 24, 24, 7, '#e0faff', OUT, 2); });
  I('velocity', '#2a4a5a', (c) => { blit(c, 'feather', 24, 24, 1.2, -0.6); });
  I('multicast', '#4a0a5a', (c) => { poly(c, [[24, 6], [34, 24], [24, 42], [14, 24]], '#e6b0ff', OUT, 2); poly(c, [[24, 6], [34, 24], [24, 24]], '#fff'); });
  I('vitality', '#3a2a0a', (c) => { blit(c, 'heart', 24, 25, 1.3); });
  I('regen', '#0a4a1a', (c) => { c.fillStyle = '#6aff8a'; c.fillRect(20, 10, 8, 28); c.fillRect(10, 20, 28, 8); });
  I('swift', '#3a2a1a', (c) => { poly(c, [[12, 34], [16, 14], [26, 14], [26, 28], [36, 30], [36, 36], [12, 36]], '#a0703a', OUT, 2); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, 20); c.lineTo(12, 20); c.moveTo(2, 28); c.lineTo(10, 28); c.stroke(); });
  I('magnet', '#1a2a5a', (c) => { blit(c, 'magnet', 24, 24, 1.3); });
  I('luck', '#1a4a1a', (c) => { for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; circle(c, 24 + Math.cos(a) * 7, 24 + Math.sin(a) * 7, 7, '#5ad06a', OUT, 2); } circle(c, 24, 24, 3, '#2a6a2a'); });
  I('crit', '#5a1a0a', (c) => { circle(c, 24, 24, 15, null, '#ff6a4a', 3); circle(c, 24, 24, 7, null, '#ff6a4a', 3); circle(c, 24, 24, 2.5, '#fff'); });
  I('duration', '#4a3a0a', (c) => { poly(c, [[14, 8], [34, 8], [24, 24], [34, 40], [14, 40], [24, 24]], '#f0d090', OUT, 2.5); });
  I('armor', '#3a3a3a', (c) => { poly(c, [[24, 6], [38, 12], [36, 28], [24, 42], [12, 28], [10, 12]], '#9aa0b0', OUT, 2.5); poly(c, [[24, 10], [34, 14], [33, 27], [24, 37]], '#c8ccd8'); });
  I('growth', '#2a1a4a', (c) => { c.fillStyle = '#7a4aca'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.roundRect(11, 10, 26, 30, 3); c.fill(); c.stroke(); c.fillStyle = '#e8dcff'; c.fillRect(14, 12, 4, 26); glowDot(c, 28, 24, 7, 'rgba(255,255,160,0.9)'); });
  I('greed', '#4a3a0a', (c) => { blit(c, 'cinder', 18, 28, 1.4); blit(c, 'cinder', 30, 20, 1.4); });
  I('reservoir', '#4a0a3a', (c) => { c.fillStyle = '#3a2a4a'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.roundRect(14, 10, 20, 30, 6); c.fill(); c.stroke(); c.fillStyle = lin(c, 0, 22, 0, 38, [[0, '#ff8ad0'], [1, '#c02a8a']]); c.beginPath(); c.roundRect(16, 22, 16, 16, 4); c.fill(); glowDot(c, 24, 28, 9, 'rgba(255,140,220,0.8)'); c.fillStyle = '#9a8aaa'; c.fillRect(18, 6, 12, 5); });
  I('thorns', '#2a3a1a', (c) => { poly(c, [[24, 6], [38, 12], [36, 28], [24, 42], [12, 28], [10, 12]], '#5a6a4a', OUT, 2.5); for (const [x, y, a] of [[10, 12, -2.4], [38, 12, -0.7], [12, 28, 2.6], [36, 28, 0.5], [24, 42, 1.57], [24, 6, -1.57]]) poly(c, [[x + Math.cos(a) * 7, y + Math.sin(a) * 7], [x + Math.cos(a + 1.6) * 2.5, y + Math.sin(a + 1.6) * 2.5], [x + Math.cos(a - 1.6) * 2.5, y + Math.sin(a - 1.6) * 2.5]], '#d8e8c0', OUT, 1.2); circle(c, 24, 24, 5, '#9ab07a', OUT, 1.5); });
  I('pact', '#3a0010', (c) => { glowDot(c, 24, 24, 20, 'rgba(255,30,80,0.8)'); poly(c, star(24, 24, 16, 6, 5, -Math.PI / 2), '#1a0008', '#ff3a6a', 2); });
  I('overcharge', '#4a3a0a', (c) => { glowDot(c, 24, 24, 20, 'rgba(255,220,90,0.9)'); poly(c, [[26, 6], [14, 26], [23, 26], [20, 42], [34, 20], [25, 20]], '#fff6c0', OUT, 2); });
  I('heal', '#4a0a1a', (c) => { blit(c, 'heart', 24, 25, 1.3); });
  I('cinderBag', '#4a2a0a', (c) => { blit(c, 'cinder', 24, 24, 2); });
}

// ---------- ground tile (separate texture for TilingSprite) ----------
export function makeGroundCanvas(pal) {
  const S = 512;
  const g = document.createElement('canvas');
  g.width = S; g.height = S;
  const c = g.getContext('2d');
  c.fillStyle = pal.base;
  c.fillRect(0, 0, S, S);
  // tile-safe stamping: draw everything wrapped
  const stamp = (fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { c.save(); c.translate(ox, oy); fn(); c.restore(); } };
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 90;
    const cols = pal.blobs;
    const col = cols[(rnd() * cols.length) | 0];
    stamp(() => { c.fillStyle = radial(c, x, y, r, [[0, col], [1, 'rgba(0,0,0,0)']]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
  }
  // flagstone path fragments
  for (let i = 0; i < 18; i++) {
    const x = rnd() * S, y = rnd() * S, w = 18 + rnd() * 26, h = 12 + rnd() * 16, a = rnd() * 0.6;
    stamp(() => {
      c.save(); c.translate(x, y); c.rotate(a);
      c.fillStyle = pal.stone; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 4); c.fill(); c.stroke();
      c.restore();
    });
  }
  // cracks
  c.lineCap = 'round';
  for (let i = 0; i < 24; i++) {
    let x = rnd() * S, y = rnd() * S;
    const pts = [[x, y]];
    for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; pts.push([x, y]); }
    stamp(() => {
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke();
    });
  }
  // speckle
  for (let i = 0; i < 1600; i++) {
    const x = rnd() * S, y = rnd() * S;
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
    c.fillRect(x, y, 2, 2);
  }
  return g;
}

// ---------- vignette (screen-space darkness: "the Gloam") ----------
export function makeVignetteCanvas() {
  const S = 512;
  const g = document.createElement('canvas');
  g.width = S; g.height = S;
  const c = g.getContext('2d');
  c.fillStyle = radial(c, S / 2, S / 2, S * 0.72, [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(0,0,0,0)'], [0.8, 'rgba(4,2,10,0.55)'], [1, 'rgba(4,2,10,0.9)']]);
  c.fillRect(0, 0, S, S);
  return g;
}

// white edge glow (transparent centre): tinted + additive for hurt flashes and the Kindle glow
export function makeEdgeGlowCanvas() {
  const S = 512;
  const g = document.createElement('canvas');
  g.width = S; g.height = S;
  const c = g.getContext('2d');
  c.fillStyle = radial(c, S / 2, S / 2, S * 0.72, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0)'], [0.82, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0.8)']]);
  c.fillRect(0, 0, S, S);
  return g;
}

export function buildAtlas() {
  drawFX();
  drawProjectiles();
  drawPickups();
  drawCharacters();
  drawEnemies();
  drawDecor();
  drawDigits();
  drawIcons();
  const source = new CanvasSource({ resource: atlasCanvas, resolution: SS, scaleMode: 'linear', autoGenerateMipmaps: false });
  for (const k in frames) {
    const f = frames[k];
    T[k] = new Texture({ source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
  }
  return T;
}

const iconCache = {};
export function iconURL(name) {
  if (iconCache[name]) return iconCache[name];
  const f = frames['icon_' + name] || frames[name];
  if (!f) return '';
  const cv = document.createElement('canvas');
  cv.width = f.w * SS; cv.height = f.h * SS;
  cv.getContext('2d').drawImage(atlasCanvas, f.x * SS, f.y * SS, f.w * SS, f.h * SS, 0, 0, f.w * SS, f.h * SS);
  return (iconCache[name] = cv.toDataURL());
}
export function spriteURL(name, scale = 1) {
  const key = name + '@' + scale;
  if (iconCache[key]) return iconCache[key];
  const f = frames[name];
  const cv = document.createElement('canvas');
  cv.width = f.w * scale; cv.height = f.h * scale;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.drawImage(atlasCanvas, f.x * SS, f.y * SS, f.w * SS, f.h * SS, 0, 0, f.w * scale, f.h * scale);
  return (iconCache[key] = cv.toDataURL());
}
