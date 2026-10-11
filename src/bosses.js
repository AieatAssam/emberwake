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
    for (let f = 0; f < 12; f++) make('matron' + f, 150, 140, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const t = (f % WALK) / WALK;
      const bob = atk < 0 ? Math.sin(t * TAU) * 3.2 : [2, -2, 5, 1][atk];
      const abd = atk < 0 ? Math.sin(t * TAU - 0.8) * 2.4 : bob * 0.4;
      const mand = atk < 0 ? 2 + Math.sin(t * TAU * 2) * 1.6 : [4, 10, 6, 3][atk];
      const step = atk < 0 ? t : 0.12;
      const brood = [[0, HEX.BROOD], [1, HEX.BROOD]];
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 76, 118, 34, 5);
      const leg = (i, s) => {
        const phase = step * TAU + i * 2.1 + (s < 0 ? 0.5 : 0);
        const swing = atk < 0 ? Math.sin(phase) : (atk === 2 ? 0.25 : -0.2);
        const lift = atk < 0 ? Math.max(0, Math.cos(phase)) * 7 : (atk === 1 ? 5 : 0);
        const hipX = 76 + s * (10 + i * 5);
        const hipY = 74 + i * 3 + bob;
        const kneeX = hipX + s * (14 + swing * 4);
        const kneeY = hipY + 14 - lift * 0.3;
        const footX = Math.max(16, Math.min(134, hipX + s * (24 + swing * 7)));
        const footY = Math.max(100, Math.min(122, 114 - lift * 0.55 + (swing > 0 ? -2 : 2)));
        tapered(c, H, hipX, hipY, kneeX, kneeY, 5.4 - i * 0.35, 3.6, brood);
        joint(c, H, kneeX, kneeY, 3.1);
        tapered(c, H, kneeX, kneeY, footX, footY, 3.4, 2.2, brood);
        ellipse(c, footX + s * 2, footY, 2.6, 1.4, HEX.BROOD, OUT, 4);
      };
      for (const s of [-1, 1]) leg(2, s);
      c.beginPath();
      c.ellipse(78, 96 + abd, 30, 18, 0.08, 0, TAU);
      c.fillStyle = HEX.BROOD;
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.save();
      c.beginPath(); c.ellipse(78, 96 + abd, 28, 16, 0.08, 0, TAU); c.clip();
      c.strokeStyle = rgba(HEX.BROOD_L, 0.55); c.lineWidth = 1.6;
      for (const k of [-6, 2, 8]) {
        c.beginPath();
        c.ellipse(78, 96 + abd + k, 22, 4, 0.08, 0.2, Math.PI - 0.2);
        c.stroke();
      }
      ellipse(c, 64, 88 + abd, 8, 4, rgba(HEX.BROOD_L, 0.85));
      ellipse(c, 62, 86 + abd, 6, 3, rgba(HEX.WHITE, 0.22));
      c.restore();
      // a clutch along the belly, not a second face
      for (const [x, y, r] of [[62, 104 + abd, 2.6], [72, 107 + abd, 3.1], [84, 106 + abd, 2.8], [94, 103 + abd, 2.4]]) {
        circle(c, x, y, r, HEX.ROSE_D, OUT, 1.4);
      }
      for (const s of [-1, 1]) { leg(1, s); leg(0, s); }
      const thorax = () => {
        c.beginPath();
        c.moveTo(74, 32 + bob);
        c.bezierCurveTo(106, 34 + bob, 112, 52 + bob, 104, 68 + bob);
        c.bezierCurveTo(98, 84 + bob, 86, 90 + bob, 74, 88 + bob);
        c.bezierCurveTo(60, 90 + bob, 48, 82 + bob, 44, 66 + bob);
        c.bezierCurveTo(36, 48 + bob, 46, 32 + bob, 74, 32 + bob);
        c.closePath();
      };
      thorax();
      c.fillStyle = HEX.BROOD;
      c.fill();
      c.save();
      thorax();
      c.clip();
      ellipse(c, 78, 82 + bob, 18, 4, rgba(HEX.INK, 0.28));
      ellipse(c, 56, 44 + bob, 12, 6, rgba(HEX.BROOD_L, 0.9));
      ellipse(c, 54, 42 + bob, 8, 4, rgba(HEX.WHITE, 0.28));
      c.strokeStyle = rgba(HEX.ROSE, 0.7); c.lineWidth = 1.6;
      c.beginPath(); c.arc(60, 46 + bob, 14, Math.PI * 1.1, Math.PI * 1.65); c.stroke();
      c.restore();
      thorax();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(74 + s * 6, 70 + bob);
        c.quadraticCurveTo(74 + s * (18 + mand), 76 + bob, 74 + s * (14 + mand), 92 + bob);
        c.quadraticCurveTo(74 + s * (6 + mand * 0.25), 84 + bob, 74 + s * 3, 76 + bob);
        c.closePath();
        c.fillStyle = lin(c, 74, 68, 74 + s * 16, 92, [[0, HEX.BROOD_L], [1, HEX.ROSE_D]]);
        c.fill();
        c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      }
      const eyes = [[56, 48], [64, 42], [74, 40], [84, 42], [92, 48], [62, 54], [86, 54]];
      const er = [2.1, 2.4, 2.9, 2.4, 2.1, 1.7, 1.7];
      eyes.forEach(([x, y], i) => {
        glowDot(c, x, y + bob, er[i] * 2.2, rgba(HEX.HEYE, 0.75));
        circle(c, x, y + bob, er[i], HEX.HEYE, OUT, 1.4);
        circle(c, x - er[i] * 0.32, y + bob - er[i] * 0.32, er[i] * 0.32, HEX.WHITE);
      });
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
        c.moveTo(hx - 30, hy + 16);
        c.lineTo(hx - 34, hy);
        c.quadraticCurveTo(hx - 32, hy - 16, hx - 8, hy - 22);
        c.lineTo(hx, hy - 30);
        c.lineTo(hx + 10, hy - 20);
        c.quadraticCurveTo(hx + 34, hy - 14, hx + 32, hy + 2);
        c.lineTo(hx + 26, hy + 18);
        c.quadraticCurveTo(hx, hy + 26, hx - 30, hy + 16);
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
      ellipse(c, 46, 26 + bob, 8, 4, rgba(HEX.WHITE, 0.4));
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
        if (atk === 2) ellipse(c, 54, 52, 20, 5, rgba(HEX.ASH_L, 0.7));
      }
    });
  }

  function drawTyrant() {
    const tongue = (c, ang, len, hot) => {
      const base = 46, tip = base + len, mid = base + len * 0.55, hw = 0.18;
      const q = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      const [x0, y0] = q(ang - hw, base);
      const [x1, y1] = q(ang + hw, base);
      const [mx, my] = q(ang, mid);
      const [tx, ty] = q(ang, tip);
      const ox = Math.cos(ang + Math.PI / 2), oy = Math.sin(ang + Math.PI / 2);
      const mw = 8 + len * 0.1;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(mx + ox * mw, my + oy * mw, tx, ty);
      c.quadraticCurveTo(mx - ox * mw * 0.8, my - oy * mw * 0.8, x1, y1);
      c.closePath();
      c.fillStyle = lin(c, tx, ty, mx * 0.2, my * 0.2, hot
        ? [[0, HEX.HFIRE], [0.42, HEX.SOL], [1, HEX.SOL_H]]
        : [[0, HEX.HFIRE_D], [0.5, HEX.SOL_D], [1, HEX.SOL]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.strokeStyle = hot ? HEX.SOL_H : HEX.SOL; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo((x0 + x1) / 2, (y0 + y1) / 2); c.quadraticCurveTo(mx, my, tx * 0.9, ty * 0.9); c.stroke();
    };
    for (let f = 0; f < 12; f++) make('tyrant' + f, 240, 240, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const breathe = atk < 0 ? 1 : [0.72, 0.56, 1.58, 0.9][atk];
      const spin = (f % WALK) * 0.08;
      c.save(); c.translate(120, 122);
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 0, 90, 32, 6, 0.26);
      glowDot(c, -10, -12, 58, rgba(HEX.SOL, 0.22));
      for (let i = 0; i < 8; i++) {
        const ang = -Math.PI / 2 + (i / 8) * TAU + spin + (atk === 2 ? 0.12 : 0);
        const len = (26 + 7 * Math.sin(i * 1.6 + spin * 2)) * breathe;
        tongue(c, ang, len, Math.cos(ang + 0.7) > 0.05);
      }
      const disc = () => { c.beginPath(); c.arc(0, 0, 48, 0, TAU); };
      disc();
      c.fillStyle = HEX.ECLIPSE;
      c.fill();
      c.save();
      disc(); c.clip();
      c.fillStyle = rgba(HEX.INK, 0.4);
      c.beginPath(); c.ellipse(14, 16, 26, 20, 0.35, 0, TAU); c.fill();
      ellipse(c, -24, -20, 8, 5, rgba(HEX.ECLIPSE_L, 0.95));
      ellipse(c, -22, -20, 8, 4.5, rgba(HEX.WHITE, 0.3));
      c.strokeStyle = HEX.SOL; c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, 0, 43, 0, TAU); c.stroke();
      if (atk === 2) {
        glowDot(c, 2, 2, 24, rgba(HEX.SOL_H, 0.85));
        c.strokeStyle = HEX.SOL_H; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-28, -6); c.lineTo(-6, 6); c.lineTo(-16, 18); c.lineTo(8, 6); c.lineTo(24, 16); c.stroke();
        c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(-20, 12); c.lineTo(2, -4); c.lineTo(16, 8); c.stroke();
      }
      c.restore();
      disc();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.strokeStyle = HEX.RIM; c.lineWidth = 2.5;
      c.beginPath(); c.arc(-6, -8, 38, Math.PI * 1.08, Math.PI * 1.7); c.stroke();
      const crown = [14, 24, 16, 36, 20, 28, 14];
      for (let i = 0; i < crown.length; i++) {
        const a = -Math.PI * 0.95 + (i / (crown.length - 1)) * Math.PI * 0.9;
        const len = crown[i] * (atk === 2 ? 1.2 : 1);
        const x = Math.cos(a) * (50 + len), y = Math.sin(a) * (50 + len);
        const lx = Math.cos(a - 0.15) * 50, ly = Math.sin(a - 0.15) * 50;
        const rx = Math.cos(a + 0.13) * 50, ry = Math.sin(a + 0.13) * 50;
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(x, y); c.lineTo(rx, ry); c.closePath();
        c.fillStyle = lin(c, x, y, 0, 6, [[0, HEX.SOL_H], [0.4, HEX.SOL], [1, HEX.HFIRE]]);
        c.fill();
        c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
        if (i % 2 === 0) circle(c, Math.cos(a) * (48 + len * 0.72), Math.sin(a) * (48 + len * 0.72), 2.1, HEX.HGLARE, OUT, 1.4);
      }
      const eyeRy = 3.6 + Math.sin((f % WALK) / WALK * TAU) * 0.3 + (atk === 2 ? 1.1 : 0);
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 15, 4); c.rotate(s * 0.4);
        ellipse(c, 0, 0, 9.2, eyeRy, HEX.HEYE, OUT, 1.4);
        ellipse(c, 0.6 * s, 0.5, 2.4, eyeRy * 0.7, HEX.INK);
        circle(c, -3.4, -1.2, 1.3, HEX.WHITE);
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
