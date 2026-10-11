// Boss sprites. Smooth volume shading only: no tiled ramps, no noise.
// Frames 0–7 are the idle/move cycle. Later frames are the attack the boss already has.

const WALK = 8;

function tapered(c, H, x0, y0, x1, y1, w0, w1, stops) {
  const { lin, OUT } = H;
  const a = Math.atan2(y1 - y0, x1 - x0);
  const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
  const bow = Math.min(w0, 8);
  const mx = (x0 + x1) / 2 + px * bow * 0.35, my = (y0 + y1) / 2 + py * bow * 0.35;
  const path = () => {
    c.beginPath();
    c.moveTo(x0 + px * w0, y0 + py * w0);
    c.quadraticCurveTo(mx + px * (w0 + w1) * 0.5, my + py * (w0 + w1) * 0.5, x1 + px * w1, y1 + py * w1);
    c.lineTo(x1 - px * w1, y1 - py * w1);
    c.quadraticCurveTo(mx - px * (w0 + w1) * 0.5, my - py * (w0 + w1) * 0.5, x0 - px * w0, y0 - py * w0);
    c.closePath();
  };
  path();
  c.fillStyle = lin(c, x0 - 10, y0 - 12, x1 + 8, y1 + 10, stops);
  c.fill();
  c.save();
  path();
  c.clip();
  c.fillStyle = H.rgba(H.HEX.INK, 0.28);
  c.beginPath();
  c.ellipse(mx + 2, my + 3, (w0 + w1) * 0.65, (w0 + w1) * 0.32, a, 0, H.TAU);
  c.fill();
  c.restore();
  path();
  c.lineWidth = 4; c.strokeStyle = OUT; c.lineJoin = 'round'; c.stroke();
}

function joint(c, H, x, y, r) {
  const { HEX, rgba, circle } = H;
  circle(c, x, y, r, HEX.BROOD, H.OUT, 4);
  circle(c, x - r * 0.28, y - r * 0.28, r * 0.32, rgba(HEX.BROOD_L, 0.9));
}

export function drawBosses(make, H) {
  const { HEX, rgba, OUT, TAU, lin, radial, circle, ellipse, poly, shadow, glowDot } = H;
  drawMatron();
  drawColossus();
  drawHerald();
  drawTyrant();
  drawHollow();

  function drawMatron() {
    const FW = 208, FH = 148;
    const lit = [[0, HEX.BROOD_L], [0.36, HEX.BROOD_L], [1, HEX.BROOD]];
    for (let f = 0; f < 12; f++) make('matron' + f, FW, FH, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const t = (f % WALK) / WALK;
      const phase = t * TAU;
      const rear = atk === 0 || atk === 1;
      const bob = atk < 0 ? Math.sin(phase) * 4.2 : [2, -4, 5, 1][atk];
      const sway = atk < 0 ? Math.sin(phase + 1.1) * 6 : 0;
      const pulse = atk < 0 ? 1 + Math.sin(phase) * 0.06 : [1.22, 1.12, 1.05, 1][atk];
      const mand = atk < 0 ? 3 + Math.sin(phase * 2) * 1.6 : [8, 16, 9, 4][atk];
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 104, 138, 62, 4);
      c.save(); c.translate(sway, 0);
      const leg = (i, s) => {
        const ph = phase + (i % 2) * Math.PI + (s < 0 ? 0.45 : 0);
        const swing = atk < 0 ? Math.sin(ph) : 0;
        const lift = atk < 0 ? Math.max(0, Math.cos(ph)) * 16 : 0;
        const hipX = 104 + s * (16 + i * 3);
        const hipY = 74 + i * 4 + bob * 0.35;
        let kneeX, kneeY, footX, footY;
        if (rear) {
          const up = (atk === 0 ? 22 : 12) + (3 - i) * 3;
          kneeX = hipX + s * (30 + i * 3);
          kneeY = hipY - up;
          footX = hipX + s * (56 + i * 5);
          footY = hipY - up * 0.55;
        } else {
          kneeX = hipX + s * (26 + swing * 14);
          kneeY = hipY + 14 - lift * 0.45;
          footX = hipX + s * (52 + i * 5 + swing * 22);
          footY = 128 - lift * 0.7 + (swing > 0 ? -4 : 3);
        }
        footX = Math.max(20, Math.min(FW - 20, footX));
        footY = Math.max(16, Math.min(FH - 12, footY));
        const w0 = 7.2 - i * 0.45;
        tapered(c, H, hipX, hipY, kneeX, kneeY, w0, w0 * 0.62, lit);
        joint(c, H, kneeX, kneeY, 4.4 - i * 0.25);
        tapered(c, H, kneeX, kneeY, footX, footY, w0 * 0.55, 2.6, lit);
        const edge = (x0, y0, x1, y1) => {
          const a = Math.atan2(y1 - y0, x1 - x0);
          const ox = Math.cos(a + Math.PI / 2), oy = Math.sin(a + Math.PI / 2);
          const k = oy > 0 ? -1 : 1;
          c.strokeStyle = HEX.BROOD_L; c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(x0 + ox * k * 2, y0 + oy * k * 2);
          c.lineTo(x1 + ox * k * 1.2, y1 + oy * k * 1.2);
          c.stroke();
        };
        edge(hipX, hipY, kneeX, kneeY);
        edge(kneeX, kneeY, footX, footY);
        ellipse(c, footX + s * 3, footY, 4.2, 2.2, HEX.BROOD, OUT, 4);
      };
      for (let i = 3; i >= 2; i--) for (const s of [-1, 1]) leg(i, s);
      const ax = 104, ay = 100 + bob * 0.3;
      const arx = 70 * pulse, ary = 32 * pulse;
      const belly = () => { c.beginPath(); c.ellipse(ax, ay, arx, ary, 0.08, 0, TAU); };
      belly();
      c.fillStyle = lin(c, ax - arx, ay - ary, ax + arx, ay + ary, lit);
      c.fill();
      c.save();
      belly(); c.clip();
      c.strokeStyle = rgba(HEX.BROOD_L, 0.85); c.lineWidth = 1.6;
      for (const k of [-10, 0, 10]) {
        c.beginPath();
        c.ellipse(ax, ay + k, arx * 0.72, 4.5, 0.08, 0.15, Math.PI - 0.15);
        c.stroke();
      }
      ellipse(c, ax - arx * 0.42, ay - ary * 0.46, 16, 8, rgba(HEX.BROOD_L, 0.95));
      c.strokeStyle = HEX.ROSE_L; c.lineWidth = 4;
      c.beginPath(); c.arc(ax - 18, ay - 8, arx * 0.55, Math.PI * 1.15, Math.PI * 1.7); c.stroke();
      c.restore();
      belly();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      const eggs = [[-46, 2, 7], [-24, 10, 9.5], [0, 12, 8], [26, 8, 11], [48, 0, 6.5]];
      for (const [dx, dy, r] of eggs) {
        const x = ax + dx * pulse, y = ay + dy * pulse;
        c.fillStyle = radial(c, x, y - 1, r * 1.7, [[0, rgba(HEX.ROSE_L, 0.5)], [1, rgba(HEX.ROSE, 0)]]);
        c.beginPath(); c.arc(x, y, r * 1.7, 0, TAU); c.fill();
      }
      for (const [dx, dy, r] of eggs) {
        const x = ax + dx * pulse, y = ay + dy * pulse;
        circle(c, x, y, r, radial(c, x - r * 0.35, y - r * 0.4, r * 1.3, [[0, HEX.ROSE_L], [0.5, HEX.ROSE], [1, HEX.ROSE_D]]), OUT, 4);
        circle(c, x - r * 0.28, y - r * 0.32, Math.max(1.2, r * 0.2), HEX.WHITE);
      }
      const thorax = () => {
        c.beginPath();
        c.moveTo(104, 18 + bob);
        c.bezierCurveTo(168, 20 + bob, 178, 46 + bob, 166, 72 + bob);
        c.bezierCurveTo(156, 96 + bob, 132, 106 + bob, 108, 102 + bob);
        c.bezierCurveTo(78, 106 + bob, 52, 94 + bob, 42, 70 + bob);
        c.bezierCurveTo(30, 44 + bob, 46, 18 + bob, 104, 18 + bob);
        c.closePath();
      };
      thorax();
      c.fillStyle = lin(c, 28, 12 + bob, 180, 108 + bob, lit);
      c.fill();
      c.save();
      thorax(); c.clip();
      ellipse(c, 108, 96 + bob, 28, 6, rgba(HEX.INK, 0.22));
      ellipse(c, 78, 42 + bob, 30, 16, HEX.BROOD_L);
      c.fillStyle = radial(c, 64, 34 + bob, 42, [[0, HEX.ROSE_L], [0.5, HEX.ROSE_L], [1, rgba(HEX.BROOD_L, 0)]]);
      c.beginPath(); c.arc(64, 34 + bob, 42, 0, TAU); c.fill();
      ellipse(c, 58, 32 + bob, 12, 6, rgba(HEX.WHITE, 0.7));
      c.strokeStyle = HEX.ROSE_L; c.lineWidth = 8;
      c.beginPath(); c.arc(80, 40 + bob, 36, Math.PI * 0.95, Math.PI * 1.75); c.stroke();
      c.restore();
      thorax();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      for (let i = 1; i >= 0; i--) for (const s of [-1, 1]) leg(i, s);
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(104 + s * 8, 74 + bob);
        c.quadraticCurveTo(104 + s * (26 + mand), 82 + bob, 104 + s * (18 + mand), 104 + bob);
        c.quadraticCurveTo(104 + s * (8 + mand * 0.25), 94 + bob, 104 + s * 4, 80 + bob);
        c.closePath();
        c.fillStyle = lin(c, 104, 70, 104 + s * 24, 104, [[0, HEX.BROOD_L], [1, HEX.ROSE_D]]);
        c.fill();
        c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      }
      const eyes = [[78, 44], [90, 36], [104, 32], [118, 36], [132, 44], [86, 50], [122, 50]];
      const er = [2.8, 3.3, 3.8, 3.3, 2.8, 2.2, 2.2];
      eyes.forEach(([x, y], i) => {
        glowDot(c, x, y + bob, er[i] * 2.4, rgba(HEX.HEYE, 0.85));
        circle(c, x, y + bob, er[i], HEX.HEYE, OUT, 1.4);
        circle(c, x - er[i] * 0.34, y + bob - er[i] * 0.36, er[i] * 0.36, HEX.WHITE);
      });
      c.restore();
    });
  }

  function drawColossus() {
    for (let f = 0; f < 11; f++) make('colossus' + f, 190, 190, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const t = (f % WALK) / WALK;
      const shift = atk < 0 ? Math.sin(t * TAU) * 12 : 0;
      const bob = atk < 0 ? -Math.abs(Math.sin(t * TAU)) * 3 : [-8, 6, 2][atk];
      const hulk = [[0, HEX.HULK_L], [0.4, HEX.HULK], [1, HEX.HULK_D]];
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 96, 166, 46, 7);
      const fist = (x, y, w, h) => {
        c.beginPath(); c.roundRect(x, y, w, h, 14);
        c.fillStyle = radial(c, x + w * 0.3, y + h * 0.28, Math.max(w, h) * 0.85, [[0, HEX.HFIRE_H], [0.28, HEX.HULK_L], [0.62, HEX.HULK], [1, HEX.HULK_D]]);
        c.fill();
        c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
        for (let k = 0; k < 3; k++) {
          const kx = x + w * (0.22 + k * 0.24), ky = y + 7;
          ellipse(c, kx, ky, 5, 3.4, lin(c, kx - 4, ky - 4, kx + 4, ky + 4, [[0, HEX.HULK_L], [1, HEX.HULK_D]]), OUT, 1.4);
        }
        c.strokeStyle = OUT; c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(x + w * 0.3, y + 14); c.lineTo(x + w * 0.42, y + h * 0.62); c.lineTo(x + w * 0.28, y + h - 8);
        c.moveTo(x + w * 0.62, y + 16); c.lineTo(x + w * 0.5, y + h * 0.7);
        c.stroke();
        c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x + w * 0.34, y + 16); c.lineTo(x + w * 0.4, y + h * 0.5); c.stroke();
        ellipse(c, x + w * 0.32, y + h * 0.3, w * 0.16, h * 0.1, rgba(HEX.WHITE, 0.4));
      };
      const armAt = (side) => {
        const swing = Math.sin(t * TAU) * side;
        const lift = atk === 0 ? -1.05 : atk === 1 ? 0.95 : atk === 2 ? 0.28 : swing * 1.15;
        const x = 96 + side * 50 + (side < 0 ? shift : -shift) * 0.25;
        const y = 78 + bob + lift * 28;
        return [x - 16, y, 34, 38];
      };
      const stoneLimb = (x0, y0, x1, y1, w0, w1) => {
        const a = Math.atan2(y1 - y0, x1 - x0);
        const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
        const pts = [
          [x0 + px * w0, y0 + py * w0],
          [x0 - px * w0 * 0.92, y0 - py * w0],
          [x1 - px * w1, y1 - py * w1],
          [x1 - px * w1 * 0.15, y1 + py * w1 * 0.2],
          [x1 + px * w1 * 0.7, y1 + py * w1],
        ];
        poly(c, pts, lin(c, x0 - 12, y0 - 14, x1 + 8, y1 + 10, hulk), OUT, 4);
        c.save();
        c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
        c.closePath();
        c.clip();
        c.strokeStyle = rgba(HEX.WHITE, 0.32); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x0 + px * w0 * 0.35, y0 + py * w0 * 0.35); c.lineTo(x1 + px * w1 * 0.25, y1 + py * w1 * 0.25); c.stroke();
        c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x0, y0 + 2); c.lineTo((x0 + x1) / 2, (y0 + y1) / 2 + 1); c.stroke();
        c.restore();
      };
      const forearm = (side) => {
        const [x, y, w, h] = armAt(side);
        const sx = (side < 0 ? 62 : 132) + shift * 0.4;
        const sy = (side < 0 ? 80 : 84) + bob;
        stoneLimb(sx, sy, x + w * 0.5, y + h * 0.42, 12, 9);
      };
      forearm(-1);
      fist(...armAt(-1));
      const foot = (side, phase) => {
        const s = atk < 0 ? Math.sin(t * TAU + phase) : 0;
        const x = 86 + side * 20 + s * 8 + shift * 0.35;
        const y = 136 + bob * 0.25 + (s > 0 ? -6 : 1);
        const kneeX = x + side * 2 + s * 6, kneeY = y + 16;
        const ankleX = kneeX + side * 6, ankleY = kneeY + 14;
        stoneLimb(x, y, kneeX, kneeY, 18, 14);
        ellipse(c, kneeX, kneeY, 11, 8, lin(c, kneeX - 8, kneeY - 6, kneeX + 8, kneeY + 8, hulk), OUT, 4);
        stoneLimb(kneeX, kneeY, ankleX, ankleY, 13, 10);
        const fy = ankleY - 2;
        poly(c, [
          [ankleX - side * 6, fy],
          [ankleX + side * 18, fy + 2],
          [ankleX + side * 22, fy + 12],
          [ankleX - side * 10, fy + 12],
          [ankleX - side * 12, fy + 4],
        ], lin(c, ankleX - 10, fy, ankleX + 16, fy + 14, hulk), OUT, 4);
        c.strokeStyle = rgba(HEX.HULK_D, 0.9); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(ankleX + side * 4, fy + 4); c.lineTo(ankleX + side * 6, fy + 12); c.stroke();
      };
      foot(-1, 0); foot(1, Math.PI);
      // pelvis and belly plates
      const plates = [
        [[58 + shift * 0.3, 148 + bob], [48, 118 + bob], [78, 108 + bob], [118, 112 + bob], [142, 124 + bob], [132, 152 + bob]],
        [[52 + shift, 112 + bob], [46, 78 + bob], [70, 62 + bob], [126, 58 + bob], [150, 84 + bob], [140, 124 + bob]],
      ];
      for (const pts of plates) {
        poly(c, pts, lin(c, pts[2][0] - 20, pts[2][1] - 10, pts[4][0], pts[5][1], hulk), OUT, 4);
        c.save();
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
        c.closePath(); c.clip();
        c.strokeStyle = rgba(HEX.WHITE, 0.35); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(pts[1][0] + 4, pts[1][1] + 2); c.lineTo(pts[2][0], pts[2][1] + 4); c.stroke();
        c.restore();
      }
      ellipse(c, 58 + shift, 82 + bob, 22, 16, lin(c, 36, 64, 80, 100, [[0, HEX.HULK_L], [0.55, HEX.HULK], [1, HEX.HULK_D]]), OUT, 4);
      ellipse(c, 134 + shift, 86 + bob, 24, 16, lin(c, 112, 68, 158, 104, hulk), OUT, 4);
      const chest = plates[1];
      c.save();
      c.beginPath(); c.moveTo(chest[0][0], chest[0][1]);
      for (let i = 1; i < chest.length; i++) c.lineTo(chest[i][0], chest[i][1]);
      c.closePath(); c.clip();
      for (const [gx, gy] of [[88, 98], [106, 96], [96, 108], [78, 114]]) {
        glowDot(c, gx + shift, gy + bob, 8, rgba(HEX.HFIRE, 0.9));
      }
      c.strokeStyle = HEX.HFIRE; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath();
      c.moveTo(74 + shift, 78 + bob); c.lineTo(88 + shift, 98 + bob); c.lineTo(78 + shift, 116 + bob);
      c.moveTo(120 + shift, 74 + bob); c.lineTo(106 + shift, 96 + bob); c.lineTo(124 + shift, 114 + bob);
      c.moveTo(92 + shift, 70 + bob); c.lineTo(98 + shift, 108 + bob);
      c.stroke();
      c.strokeStyle = HEX.HFIRE_H; c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(76 + shift, 82 + bob); c.lineTo(86 + shift, 98 + bob); c.lineTo(80 + shift, 112 + bob);
      c.moveTo(118 + shift, 78 + bob); c.lineTo(108 + shift, 96 + bob);
      c.stroke();
      c.restore();
      const hx = 98 + shift, hy = 58 + bob;
      const helm = () => {
        c.beginPath();
        c.moveTo(hx - 34, hy + 18);
        c.lineTo(hx - 39, hy);
        c.quadraticCurveTo(hx - 36, hy - 18, hx - 9, hy - 25);
        c.lineTo(hx, hy - 34);
        c.lineTo(hx + 12, hy - 23);
        c.quadraticCurveTo(hx + 39, hy - 16, hx + 37, hy + 2);
        c.lineTo(hx + 30, hy + 20);
        c.quadraticCurveTo(hx, hy + 30, hx - 34, hy + 18);
        c.closePath();
      };
      helm();
      c.fillStyle = lin(c, hx - 28, hy - 28, hx + 30, hy + 22, [[0, HEX.HULK_L], [0.35, HEX.HULK], [1, HEX.HULK_D]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.save(); helm(); c.clip();
      ellipse(c, hx - 12, hy - 8, 12, 6, rgba(HEX.WHITE, 0.38));
      c.restore();
      helm(); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = HEX.HFIRE; c.fillRect(hx - 12, hy + 4, 22, 5);
      glowDot(c, hx - 6, hy + 6, 7, rgba(HEX.HFIRE, 0.9));
      glowDot(c, hx + 8, hy + 6, 7, rgba(HEX.HFIRE, 0.9));
      forearm(1);
      fist(...armAt(1));
      if (atk === 1 || atk === 2) {
        const a = atk === 1 ? 0.5 : 0.22;
        ellipse(c, 70, 168, 14, 4, rgba(HEX.HULK_L, a));
        ellipse(c, 124, 170, 16, 4, rgba(HEX.HULK_L, a * 0.8));
        ellipse(c, 96, 166, 18, 3.5, rgba(HEX.HFIRE, a * 0.6));
      }
    });
  }


  function drawHerald() {
    for (let f = 0; f < 12; f++) make('herald' + f, 90, 120, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const t = (f % WALK) / WALK;
      const bob = atk < 0 ? Math.sin(t * TAU) * 5.4 : [1, -3, 2, 0][atk];
      const hemLag = atk < 0 ? Math.sin(t * TAU + Math.PI / 4) * 8 : [1, -4, 5, 1][atk];
      const clothLag = atk < 0 ? Math.sin(t * TAU + 1) * 5 : [2, 7, 3, -2][atk];
      const fade = atk < 0 ? 1 : [0.88, 0.42, 0.14, 0.66][atk];
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 54, 106, 16, 4, 0.28);
      c.save();
      c.globalAlpha = fade;
      c.strokeStyle = OUT; c.lineWidth = 4;
      c.beginPath(); c.moveTo(18, 102); c.lineTo(18, 18 + bob * 0.12); c.stroke();
      c.strokeStyle = HEX.WOOD; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(18, 100); c.lineTo(18, 20 + bob * 0.12); c.stroke();
      const robe = () => {
        c.beginPath();
        c.moveTo(54, 30 + bob);
        c.bezierCurveTo(74, 36 + bob, 76, 64 + bob, 70, 84 + bob);
        c.lineTo(66, 90 + hemLag * 0.3);
        c.lineTo(58, 82 + hemLag);
        c.lineTo(50, 94 + hemLag * 0.4);
        c.lineTo(42, 84 + hemLag * 0.15);
        c.lineTo(36, 92);
        c.bezierCurveTo(32, 66 + bob, 34, 38 + bob, 54, 30 + bob);
        c.closePath();
      };
      robe();
      c.fillStyle = lin(c, 32, 24 + bob, 76, 98, [[0, HEX.ASH_L], [0.4, HEX.ASH], [1, HEX.ASH]]);
      c.fill();
      c.save(); robe(); c.clip();
      c.fillStyle = rgba(HEX.ASH_L, 0.9);
      c.beginPath();
      c.moveTo(42, 38 + bob); c.quadraticCurveTo(36, 62 + bob, 44, 86);
      c.lineTo(38, 84); c.quadraticCurveTo(34, 60 + bob, 40, 36 + bob); c.fill();
      c.fillStyle = rgba(HEX.INK, 0.32);
      c.beginPath();
      c.moveTo(62, 42 + bob); c.quadraticCurveTo(70, 66 + bob, 64, 88 + hemLag * 0.15);
      c.lineTo(58, 86); c.quadraticCurveTo(60, 64 + bob, 56, 44 + bob); c.fill();
      c.fillStyle = rgba(HEX.ASH_L, 0.4);
      c.beginPath();
      c.moveTo(50, 50 + bob); c.quadraticCurveTo(46, 70, 52, 90);
      c.lineTo(48, 88); c.quadraticCurveTo(44, 68, 48, 52 + bob); c.fill();
      c.restore();
      robe();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.beginPath();
      c.moveTo(54, 18 + bob);
      c.bezierCurveTo(70, 22 + bob, 68, 42 + bob, 54, 48 + bob);
      c.bezierCurveTo(38, 42 + bob, 36, 22 + bob, 54, 18 + bob);
      c.closePath();
      c.fillStyle = lin(c, 36, 16 + bob, 70, 48 + bob, [[0, HEX.ASH_L], [0.5, HEX.ASH], [1, HEX.ASH]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      ellipse(c, 45, 25 + bob, 6, 2.4, rgba(HEX.ASH_L, 0.28));
      ellipse(c, 54, 32 + bob, 6.5, 7.5, HEX.INK);
      ellipse(c, 50.5, 30 + bob, 1.4, 2.2, HEX.FROST_H);
      ellipse(c, 57.5, 30 + bob, 1.4, 2.2, HEX.FROST_H);
      const banner = () => {
        c.beginPath();
        c.moveTo(16, 22);
        c.lineTo(34, 26);
        c.quadraticCurveTo(40, 36 + clothLag * 0.2, 32, 44 + clothLag * 0.3);
        c.lineTo(38, 52 + clothLag * 0.35);
        c.lineTo(28, 48 + clothLag * 0.25);
        c.lineTo(22, 60 + clothLag * 0.3);
        c.lineTo(14, 40);
        c.closePath();
      };
      banner();
      c.fillStyle = lin(c, 14, 20, 38, 62, [[0, HEX.HEYE], [0.5, HEX.HEYE], [1, HEX.HEYE_D]]);
      c.fill();
      c.save(); banner(); c.clip();
      c.fillStyle = rgba(HEX.HEYE_D, 0.7);
      c.beginPath(); c.moveTo(20, 30); c.quadraticCurveTo(30, 42, 22, 56); c.lineTo(16, 50); c.quadraticCurveTo(24, 38, 18, 28); c.fill();
      c.restore();
      banner();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.restore();
      if (atk >= 0) {
        const lift = [4, 14, 26, 8][atk];
        for (let i = 0; i < 5; i++) {
          ellipse(c, 28 + i * 9, 78 - lift - (i % 3) * 6, 3.4, 1.5, i % 2 ? rgba(HEX.ASH_L, 0.95) : rgba(HEX.SPIRIT, 0.8));
        }
        if (atk === 2) {
          c.fillStyle = radial(c, 54, 52, 16, [[0, rgba(HEX.ASH_L, 0.45)], [0.55, rgba(HEX.ASH_L, 0.12)], [1, rgba(HEX.ASH_L, 0)]]);
          c.beginPath(); c.arc(54, 52, 16, 0, TAU); c.fill();
        }
      }
    });
  }

  function drawTyrant() {
    const flame = [[0, HEX.SOL_H], [0.78, HEX.SOL_H], [0.9, HEX.SOL], [1, HEX.HFIRE]];
    const at = (ang, r) => [Math.cos(ang) * r, Math.sin(ang) * r];
    // Bottom of the 240 frame, under the anchor, is the tight edge. Clamp there only.
    const room = (ang) => {
      const cs = Math.cos(ang), sn = Math.sin(ang);
      let m = 150;
      if (sn > 0.08) m = Math.min(m, 82 / sn);
      if (sn < -0.08) m = Math.min(m, 132 / -sn);
      if (Math.abs(cs) > 0.08) m = Math.min(m, 106 / Math.abs(cs));
      return m;
    };
    const lick = (c, ang, base, len, hw, fat) => {
      const tipR = Math.max(base + 8, Math.min(base + len, room(ang) - 2));
      const mid = base + (tipR - base) * 0.52;
      const [x0, y0] = at(ang - hw, base);
      const [x1, y1] = at(ang + hw, base);
      const [mx, my] = at(ang, mid);
      const [tx, ty] = at(ang, tipR);
      const ox = Math.cos(ang + Math.PI / 2), oy = Math.sin(ang + Math.PI / 2);
      const path = () => {
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(mx + ox * fat, my + oy * fat, tx, ty);
        c.quadraticCurveTo(mx - ox * fat * 0.7, my - oy * fat * 0.7, x1, y1);
        c.closePath();
      };
      path();
      c.fillStyle = lin(c, (x0 + x1) / 2, (y0 + y1) / 2, tx, ty, flame);
      c.fill();
      // Hostile fire under the ink keeps the gold edge from blending to olive.
      path(); c.lineWidth = 4; c.strokeStyle = HEX.HFIRE; c.stroke();
      path(); c.lineWidth = 2.5; c.strokeStyle = OUT; c.stroke();
    };
    for (let f = 0; f < 12; f++) make('tyrant' + f, 240, 240, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const idle = atk < 0;
      const wind = atk === 0 || atk === 1;
      const phase = idle ? (f / WALK) * TAU : (wind ? 0.45 : 2.15);
      c.save();
      c.translate(120, 148);
      c.lineJoin = 'round';
      c.lineCap = 'round';
      shadow(c, 0, 74, 30, 4, 0.26);
      const haloR = wind ? 86 : idle ? 83 + 3 * Math.cos(phase * 2) : 80;
      c.fillStyle = radial(c, 0, 0, haloR, [
        [0, HEX.SOL_H],
        [0.9, HEX.SOL_H],
        [0.95, HEX.SOL],
        [0.98, HEX.HFIRE],
        [1, rgba(HEX.HFIRE, 0)],
      ]);
      c.beginPath(); c.arc(0, 0, haloR, 0, TAU); c.fill();
      for (let i = 0; i < 12; i++) {
        const sway = Math.sin(phase + i * 0.85) * (idle ? 0.11 : 0.04);
        const ang = -Math.PI / 2 + ((i + 0.5) / 12) * TAU + sway;
        const wave = Math.sin(phase + i * 1.7);
        const len = wind ? (atk === 0 ? 110 : 92) + 4 * wave
          : idle ? 40 + 5 * wave
          : (atk === 2 ? 8 : 16) + 2 * wave;
        lick(c, ang, 48, len, wind ? 0.36 : 0.16, wind ? 26 : 11);
      }
      const crownH = [18, 32, 16, 48, 18, 36, 18];
      for (let i = 0; i < crownH.length; i++) {
        const ang = -Math.PI * 0.9 + (i / 6) * Math.PI * 0.8 + Math.sin(phase + i) * 0.07;
        const wob = idle ? Math.sin(phase + i * 0.7) * 6 : wind ? 44 : 0;
        lick(c, ang, 70, crownH[i] + wob, wind ? 0.12 : 0.07, wind ? 12 : 6);
      }
      const discR = 64;
      c.beginPath(); c.arc(0, 0, discR, 0, TAU);
      c.fillStyle = radial(c, -40, -34, 90, [[0, HEX.ECLIPSE_L], [1, HEX.ECLIPSE]]);
      c.fill();
      if (atk >= 2) {
        c.save();
        c.beginPath(); c.arc(0, 0, discR - 1, 0, TAU); c.clip();
        if (atk === 2) {
          c.strokeStyle = HEX.SOL_H; c.lineWidth = 2.5;
          c.beginPath();
          c.moveTo(-34, -12); c.lineTo(-4, 6); c.lineTo(-16, 24); c.lineTo(16, 4); c.lineTo(32, 20);
          c.stroke();
          glowDot(c, 0, 2, 14, HEX.SOL_H);
        }
        c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(-26, 12); c.lineTo(4, -6); c.lineTo(22, 12); c.stroke();
        c.restore();
      }
      c.beginPath(); c.arc(0, 0, discR - 5, 0, TAU);
      c.strokeStyle = HEX.SOL_H; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.arc(0, 0, discR, 0, TAU);
      c.strokeStyle = HEX.HFIRE; c.lineWidth = 8; c.stroke();
      c.beginPath(); c.arc(0, 0, discR, 0, TAU);
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      for (const s of [-1, 1]) {
        c.save();
        c.translate(s * 20, 2);
        c.scale(s, 1);
        c.strokeStyle = HEX.HEYE; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-15, 3); c.quadraticCurveTo(0, -10, 16, -4); c.stroke();
        ellipse(c, 1, 4, 13, 6.5, HEX.HEYE, OUT, 1.4);
        ellipse(c, 2.2, 4.8, 4.2, 3.4, HEX.INK);
        circle(c, -3.2, 2.4, 3.2, HEX.SOL_H);
        circle(c, -4.4, 1.3, 1.5, HEX.WHITE);
        c.restore();
      }
      c.restore();
    });
  }

  function drawHollow() {
    for (let f = 0; f < WALK; f++) make('hollow' + f, 110, 120, (c) => {
      const t = f / WALK;
      const sway = Math.sin(t * TAU) * 7;
      const hem = Math.sin(t * TAU + Math.PI / 5) * 7;
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 54, 102, 22, 4, 0.26);
      const shroud = () => {
        c.beginPath();
        c.moveTo(54 + sway * 0.1, 14);
        c.bezierCurveTo(76 + sway * 0.35, 18, 82 + sway * 0.2, 42, 88 + sway * 0.28, 66);
        c.bezierCurveTo(94 + sway * 0.15, 80, 84 + sway * 0.25, 86, 78 + sway * 0.25, 82);
        for (let i = 0; i < 5; i++) {
          const x = 76 - i * 12 + sway * 0.2;
          const lag = hem * (i % 2 ? 1 : -0.3);
          const drop = i === 1 ? 6 : i === 4 ? 4 : 0;
          c.lineTo(x, 88 + lag + drop);
          c.lineTo(x - 11, 80 + lag * 0.2);
        }
        c.bezierCurveTo(18 + sway * 0.15, 72, 26, 34, 40, 20);
        c.quadraticCurveTo(48, 10, 54 + sway * 0.1, 14);
        c.closePath();
      };
      shroud();
      c.fillStyle = HEX.ABYSS;
      c.fill();
      c.save(); shroud(); c.clip();
      ellipse(c, 38, 36, 8, 14, rgba(HEX.ABYSS_L, 0.8));
      ellipse(c, 70, 48, 6, 16, rgba(HEX.INK, 0.28));
      c.fillStyle = lin(c, 20, 74, 88, 100, [[0, HEX.ROSE_D], [1, HEX.ROSE]]);
      c.beginPath(); c.moveTo(24, 76);
      for (let i = 0; i < 5; i++) {
        const x = 76 - i * 12 + sway * 0.2;
        const lag = hem * (i % 2 ? 1 : -0.3);
        const drop = i === 1 ? 6 : i === 4 ? 4 : 0;
        c.lineTo(x, 84 + lag + drop);
        c.lineTo(x - 11, 76 + lag * 0.2);
      }
      c.closePath(); c.fill();
      c.restore();
      shroud();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      const skull = () => {
        c.beginPath();
        c.moveTo(54, 24);
        c.bezierCurveTo(74, 26, 76, 46, 68, 62);
        c.quadraticCurveTo(54, 72, 40, 62);
        c.bezierCurveTo(32, 46, 34, 26, 54, 24);
        c.closePath();
      };
      skull();
      c.fillStyle = lin(c, 34, 20, 74, 70, [[0, HEX.WHITE], [0.42, HEX.FROST_H], [1, HEX.FROST_L]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      ellipse(c, 44, 32, 8, 3.5, rgba(HEX.WHITE, 0.65));
      ellipse(c, 43, 44, 5.2, 8.5, HEX.INK);
      ellipse(c, 65, 44, 5.2, 8.5, HEX.INK);
      ellipse(c, 41, 40, 1.5, 2.2, HEX.FROST_H);
      ellipse(c, 63, 40, 1.5, 2.2, HEX.SPIRIT_L);
      ellipse(c, 54, 62, 6.5, 2.2, HEX.INK);
      c.strokeStyle = rgba(HEX.FROST_D, 0.75); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(50, 30); c.lineTo(53, 38); c.lineTo(49, 50); c.stroke();
    });
  }
}
