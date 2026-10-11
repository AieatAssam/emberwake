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
  circle(c, x, y, r, HEX.GLOOM_D, H.OUT, 1.4);
  circle(c, x - r * 0.3, y - r * 0.3, r * 0.35, rgba(HEX.GLOOM_L, 0.9));
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
      const bob = atk < 0 ? Math.sin(t * TAU) * 2.2 : [2, -2, 6, 1][atk];
      const abd = atk < 0 ? Math.sin(t * TAU - 0.8) * 2.4 : bob * 0.45;
      const mand = atk < 0 ? 2 + Math.sin(t * TAU * 2) * 1.4 : [4, 12, 8, 3][atk];
      const step = atk < 0 ? t : 0.15;
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 76, 130, 56, 11);
      const leg = (i, s, back) => {
        const phase = step * TAU + (i % 2) * Math.PI + (s < 0 ? 0.35 : 0);
        const swing = atk < 0 ? Math.sin(phase) : (atk === 2 ? 0.2 : -0.15);
        const lift = atk < 0 ? Math.max(0, Math.cos(phase)) * 9 : (atk === 1 ? 6 : 0);
        const hipX = 74 + s * (16 + i * 3);
        const hipY = 78 + i * 6 + bob;
        const kneeX = hipX + s * (18 + swing * 6);
        const kneeY = hipY + 14 - lift * 0.45;
        const footX = hipX + s * (36 + i * 7 + swing * 16);
        const footY = 126 - lift + (swing > 0 ? -2 : 3);
        if (!back) return;
        const gloom = [[0, HEX.GLOOM_L], [0.5, HEX.GLOOM], [1, HEX.GLOOM_D]];
        tapered(c, H, hipX, hipY, kneeX, kneeY, 8.4 - i * 0.4, 5.6, gloom);
        joint(c, H, kneeX, kneeY, 4.2);
        tapered(c, H, kneeX, kneeY, footX, footY, 5.2, 2.2, gloom);
        ellipse(c, footX + s * 3, footY, 3.2, 1.6, HEX.GLOOM_D, OUT, 4);
        poly(c, [[footX + s * 5, footY - 1], [footX + s * 11, footY + 2], [footX + s * 4, footY + 3]], HEX.GLOOM_D, OUT, 4);
      };
      for (let i = 3; i >= 2; i--) for (const s of [-1, 1]) leg(i, s, true);
      // abdomen, behind the thorax, with a lagging bob
      c.beginPath();
      c.ellipse(80, 100 + abd, 36, 24, 0.15, 0, TAU);
      c.fillStyle = radial(c, 64, 86 + abd, 48, [[0, HEX.GLOOM_L], [0.45, HEX.GLOOM], [1, HEX.GLOOM_D]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.save();
      c.beginPath(); c.ellipse(80, 100 + abd, 34, 22, 0.15, 0, TAU); c.clip();
      c.strokeStyle = rgba(HEX.GLOOM_D, 0.9); c.lineWidth = 1.6;
      for (const k of [-8, 2, 12]) {
        c.beginPath();
        c.ellipse(80, 100 + abd + k, 30 - Math.abs(k) * 0.3, 5, 0.15, 0.15, Math.PI - 0.15);
        c.stroke();
      }
      ellipse(c, 62, 90 + abd, 12, 6, rgba(HEX.WHITE, 0.28));
      c.restore();
      // egg sacs along the belly
      for (const [x, y, r] of [[58, 112 + abd, 7], [78, 118 + abd, 8.5], [98, 110 + abd, 6.5]]) {
        circle(c, x, y, r, radial(c, x - 2, y - 2, r, [[0, HEX.ROSE_L], [0.55, HEX.ROSE], [1, HEX.ROSE_D]]), OUT, 4);
        circle(c, x - r * 0.3, y - r * 0.35, r * 0.28, rgba(HEX.WHITE, 0.75));
      }
      for (let i = 1; i >= 0; i--) for (const s of [-1, 1]) leg(i, s, true);
      // fused head-thorax
      const thorax = () => {
        c.beginPath();
        c.moveTo(74, 34 + bob);
        c.bezierCurveTo(104, 36 + bob, 112, 54 + bob, 104, 70 + bob);
        c.bezierCurveTo(98, 86 + bob, 86, 92 + bob, 74, 90 + bob);
        c.bezierCurveTo(60, 92 + bob, 48, 84 + bob, 44, 68 + bob);
        c.bezierCurveTo(36, 50 + bob, 46, 34 + bob, 74, 34 + bob);
        c.closePath();
      };
      thorax();
      c.fillStyle = lin(c, 40, 28 + bob, 112, 96 + bob, [[0, HEX.GLOOM_L], [0.42, HEX.GLOOM], [1, HEX.GLOOM_D]]);
      c.fill();
      c.save();
      thorax();
      c.clip();
      ellipse(c, 74, 96 + bob, 22, 5, rgba(HEX.INK, 0.35));
      ellipse(c, 58, 48 + bob, 14, 7, rgba(HEX.WHITE, 0.32));
      c.strokeStyle = rgba(HEX.GLOOM_L, 0.8); c.lineWidth = 1.6;
      c.beginPath(); c.arc(62, 46 + bob, 16, Math.PI * 1.05, Math.PI * 1.7); c.stroke();
      c.restore();
      thorax();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      // mandibles
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(74 + s * 8, 72 + bob);
        c.quadraticCurveTo(74 + s * (22 + mand), 78 + bob, 74 + s * (16 + mand), 96 + bob);
        c.quadraticCurveTo(74 + s * (8 + mand * 0.3), 88 + bob, 74 + s * 4, 78 + bob);
        c.closePath();
        c.fillStyle = lin(c, 74, 70, 74 + s * 20, 96, [[0, HEX.GLOOM_L], [1, HEX.ROSE_D]]);
        c.fill();
        c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      }
      const eyes = [[58, 50], [66, 44], [74, 42], [82, 44], [90, 50], [63, 56], [85, 56]];
      const er = [2, 2.3, 2.8, 2.3, 2, 1.7, 1.7];
      eyes.forEach(([x, y], i) => {
        glowDot(c, x, y + bob, er[i] * 2.4, rgba(HEX.HEYE, 0.8));
        circle(c, x, y + bob, er[i], HEX.HEYE, OUT, 1.4);
        circle(c, x - er[i] * 0.35, y + bob - er[i] * 0.35, er[i] * 0.35, HEX.WHITE);
      });
    });
  }

  function drawColossus() {
    for (let f = 0; f < 10; f++) make('colossus' + f, 190, 190, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const t = (f % WALK) / WALK;
      const shift = atk < 0 ? Math.sin(t * TAU) * 14 : 0;
      const bob = atk < 0 ? -Math.abs(Math.sin(t * TAU)) * 3 : (atk === 0 ? -10 : 8);
      const arm = atk < 0 ? Math.sin(t * TAU) : (atk === 0 ? -1.1 : 1);
      const hulk = [[0, HEX.HULK_L], [0.45, HEX.HULK], [1, HEX.HULK_D]];
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 96, 178, 64, 12);
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
        const lift = atk === 0 ? -1.2 : atk === 1 ? 1.15 : arm * side * 1.35;
        const x = 96 + side * 62 + (side < 0 ? shift : -shift) * 0.3;
        const y = 70 + bob + lift * 34;
        return [x - 16, y, 36, 42];
      };
      // far arm, then legs, then body, then near arm
      fist(...armAt(-1));
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
      // shoulders
      ellipse(c, 58 + shift, 78 + bob, 22, 16, lin(c, 40, 60, 80, 96, hulk), OUT, 4);
      ellipse(c, 136 + shift, 82 + bob, 24, 16, lin(c, 116, 64, 160, 100, hulk), OUT, 4);
      // molten core, after the plates so it lights them
      glowDot(c, 96 + shift, 96 + bob, 34, rgba(HEX.HFIRE, 0.95));
      circle(c, 96 + shift, 98 + bob, 15, radial(c, 90 + shift, 92 + bob, 18, [[0, HEX.HFIRE_H], [0.4, HEX.HFIRE], [1, HEX.HFIRE_D]]), OUT, 1.6);
      c.strokeStyle = HEX.HFIRE; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(78 + shift, 88 + bob); c.lineTo(88 + shift, 102 + bob); c.lineTo(80 + shift, 114 + bob);
      c.moveTo(118 + shift, 84 + bob); c.lineTo(108 + shift, 100 + bob); c.lineTo(122 + shift, 116 + bob);
      c.stroke();
      // helm sunk between the shoulders, brow lit from the upper left
      const hx = 98 + shift, hy = 52 + bob;
      c.beginPath();
      c.moveTo(hx - 24, hy + 14);
      c.lineTo(hx - 28, hy + 2);
      c.quadraticCurveTo(hx - 26, hy - 18, hx, hy - 20);
      c.quadraticCurveTo(hx + 28, hy - 16, hx + 26, hy + 4);
      c.lineTo(hx + 20, hy + 16);
      c.quadraticCurveTo(hx, hy + 22, hx - 24, hy + 14);
      c.closePath();
      c.fillStyle = lin(c, hx - 20, hy - 22, hx + 24, hy + 20, hulk);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.beginPath();
      c.moveTo(hx - 6, hy - 20); c.lineTo(hx, hy - 30); c.lineTo(hx + 8, hy - 18);
      c.fillStyle = lin(c, hx - 6, hy - 30, hx + 8, hy - 16, hulk); c.fill();
      c.strokeStyle = OUT; c.lineWidth = 4; c.stroke();
      ellipse(c, hx - 10, hy - 8, 8, 4, rgba(HEX.WHITE, 0.35));
      c.fillStyle = HEX.HFIRE; c.fillRect(hx - 10, hy + 2, 18, 4);
      glowDot(c, hx - 6, hy + 4, 6, rgba(HEX.HFIRE, 0.9));
      glowDot(c, hx + 6, hy + 4, 6, rgba(HEX.HFIRE, 0.9));
      c.strokeStyle = OUT; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(hx - 16, hy - 4); c.lineTo(hx - 8, hy + 6); c.lineTo(hx - 14, hy + 12); c.stroke();
      fist(...armAt(1));
      if (atk === 1) {
        ellipse(c, 62, 172, 16, 5, rgba(HEX.HULK_L, 0.55));
        ellipse(c, 128, 174, 18, 5, rgba(HEX.HULK_L, 0.4));
        ellipse(c, 96, 170, 22, 4, rgba(HEX.HFIRE, 0.35));
      }
    });
  }

  function drawHerald() {
    for (let f = 0; f < 12; f++) make('herald' + f, 90, 120, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const t = (f % WALK) / WALK;
      const bob = atk < 0 ? Math.sin(t * TAU) * 6 : [1, -4, 2, 0][atk];
      const hemLag = atk < 0 ? Math.sin(t * TAU - 0.9) * 9 : [2, -8, 10, 1][atk];
      const clothLag = atk < 0 ? Math.sin(t * TAU - 1.4) * 7 : hemLag * 0.6;
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 42, 112, 22, 5, 0.3);
      // pole behind the figure
      c.strokeStyle = OUT; c.lineWidth = 4;
      c.beginPath(); c.moveTo(76, 110); c.lineTo(76, 6 + bob * 0.3); c.stroke();
      c.strokeStyle = HEX.WOOD; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(76, 108); c.lineTo(76, 8 + bob * 0.3); c.stroke();
      const robe = () => {
        c.beginPath();
        c.moveTo(44, 24 + bob);
        c.bezierCurveTo(66, 32 + bob, 64, 68 + bob, 60, 92 + bob);
        c.lineTo(54, 98 + hemLag * 0.4 + bob);
        c.lineTo(46, 90 + hemLag + bob);
        c.lineTo(38, 104 + hemLag * 0.5 + bob);
        c.lineTo(30, 94 + hemLag * 0.2 + bob);
        c.lineTo(22, 100 + bob);
        c.bezierCurveTo(18, 64 + bob, 22, 32 + bob, 44, 24 + bob);
        c.closePath();
      };
      robe();
      c.fillStyle = lin(c, 20, 18 + bob, 66, 108, [[0, HEX.SHROUD], [0.55, HEX.SHROUD], [1, HEX.SHROUD_D]]);
      c.fill();
      c.save(); robe(); c.clip();
      c.fillStyle = rgba(HEX.SHROUD_D, 0.55);
      c.beginPath();
      c.moveTo(50, 36 + bob); c.quadraticCurveTo(58, 60, 52, 96 + hemLag * 0.3); c.lineTo(44, 98 + hemLag * 0.2); c.quadraticCurveTo(46, 60, 42, 40 + bob);
      c.fill();
      c.fillStyle = rgba(HEX.WHITE, 0.2);
      c.beginPath();
      c.moveTo(30, 34 + bob); c.quadraticCurveTo(28, 58, 32, 90 + hemLag * 0.2); c.lineTo(26, 88); c.quadraticCurveTo(24, 56, 28, 32 + bob);
      c.fill();
      c.fillStyle = rgba(HEX.SHROUD_D, 0.62);
      c.beginPath();
      c.moveTo(40, 48 + bob); c.quadraticCurveTo(36, 70 + bob, 42, 96 + hemLag * 0.35);
      c.lineTo(36, 98 + hemLag * 0.2); c.quadraticCurveTo(32, 68 + bob, 36, 46 + bob);
      c.fill();
      c.restore();
      robe();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      // hood
      c.beginPath();
      c.moveTo(44, 8 + bob);
      c.bezierCurveTo(64, 12 + bob, 62, 36 + bob, 44, 42 + bob);
      c.bezierCurveTo(26, 36 + bob, 24, 12 + bob, 44, 8 + bob);
      c.fillStyle = lin(c, 26, 6 + bob, 64, 44 + bob, [[0, HEX.SHROUD], [1, HEX.SHROUD_D]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      ellipse(c, 36, 16 + bob, 8, 4, rgba(HEX.WHITE, 0.28));
      ellipse(c, 44, 24 + bob, 8, 10, HEX.INK);
      ellipse(c, 40, 22 + bob, 1.6, 2.4, HEX.FROST_H);
      ellipse(c, 48, 22 + bob, 1.6, 2.4, HEX.FROST_H);
      circle(c, 39.4, 21.2 + bob, 0.7, HEX.WHITE);
      circle(c, 47.4, 21.2 + bob, 0.7, HEX.WHITE);
      // banner cloth in front, lagging the body
      c.beginPath();
      c.moveTo(74, 12 + bob * 0.2);
      c.lineTo(58, 16 + clothLag * 0.15);
      c.quadraticCurveTo(50, 26 + clothLag * 0.35, 56, 34 + clothLag);
      c.lineTo(50, 40 + clothLag);
      c.lineTo(60, 44 + clothLag * 0.65);
      c.lineTo(66, 36 + clothLag * 0.3);
      c.lineTo(72, 50 + clothLag);
      c.lineTo(76, 26);
      c.closePath();
      c.fillStyle = lin(c, 50, 12, 76, 52, [[0, HEX.SLATE_L], [0.45, HEX.SLATE], [1, HEX.SLATE_D]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.save();
      c.clip();
      c.fillStyle = rgba(HEX.SLATE_D, 0.55);
      c.beginPath(); c.moveTo(70, 18); c.quadraticCurveTo(62, 28 + clothLag * 0.4, 68, 46 + clothLag); c.lineTo(74, 40); c.quadraticCurveTo(66, 26, 74, 16); c.fill();
      c.restore();
      c.beginPath();
      c.moveTo(74, 12 + bob * 0.2);
      c.lineTo(58, 16 + clothLag * 0.15);
      c.quadraticCurveTo(50, 26 + clothLag * 0.35, 56, 34 + clothLag);
      c.lineTo(50, 40 + clothLag);
      c.lineTo(60, 44 + clothLag * 0.65);
      c.lineTo(66, 36 + clothLag * 0.3);
      c.lineTo(72, 50 + clothLag);
      c.lineTo(76, 26);
      c.closePath();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.fillStyle = HEX.BONE;
      c.beginPath();
      c.moveTo(66, 22 + clothLag * 0.3); c.lineTo(70, 28); c.lineTo(66, 34 + clothLag * 0.2); c.lineTo(62, 28); c.closePath();
      c.fill();
      c.lineWidth = 1.4; c.strokeStyle = OUT; c.stroke();
    });
  }

  function drawTyrant() {
    const tongue = (c, ang, len, curl) => {
      const base = 46, w = 0.2;
      const tipA = ang + curl;
      const q = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      const [x0, y0] = q(ang - w, base);
      const [x1, y1] = q(ang + w * 0.65, base);
      const [mx, my] = q(ang + curl * 0.5, base + len * 0.58);
      const [tx, ty] = q(tipA, base + len);
      const ox = Math.cos(ang + Math.PI / 2), oy = Math.sin(ang + Math.PI / 2);
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(mx + ox * 12, my + oy * 12, tx, ty);
      c.quadraticCurveTo(mx - ox * 5, my - oy * 5, x1, y1);
      c.closePath();
      c.fillStyle = radial(c, mx, my, len * 0.8, [[0, HEX.HFIRE_H], [0.4, HEX.HFIRE], [1, HEX.HFIRE_D]]);
      c.fill();
      c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
    };
    for (let f = 0; f < 12; f++) make('tyrant' + f, 240, 240, (c) => {
      const atk = f >= WALK ? f - WALK : -1;
      const breathe = atk < 0 ? 1 : [0.62, 0.48, 1.22, 0.84][atk];
      const spin = (f % WALK) * 0.18 + (atk === 2 ? 0.4 : 0);
      c.save(); c.translate(120, 112);
      shadow(c, 0, 108, 40, 10, 0.28);
      glowDot(c, 0, 0, 78, rgba(HEX.HFIRE, 0.45));
      for (let i = 0; i < 12; i++) {
        const ang = -Math.PI / 2 + (i / 12) * TAU + spin + 0.22;
        const len = (12 + 7 * Math.sin(i * 2.1 + spin)) * breathe;
        tongue(c, ang, len, 0.2 * Math.sin(i + spin));
      }
      for (let i = 0; i < 12; i++) {
        const ang = -Math.PI / 2 + (i / 12) * TAU + spin;
        const len = (26 + 14 * Math.sin(i * 1.7 + spin * 2) + (i % 3 === 0 ? 6 : 0)) * breathe;
        const curl = 0.5 * Math.sin(i * 1.3 + spin) + (i % 2 ? 0.22 : -0.18);
        tongue(c, ang, len, curl);
      }
      c.beginPath(); c.arc(0, 0, 48, 0, TAU);
      c.fillStyle = radial(c, -16, -18, 78, [[0, HEX.SHROUD], [0.22, HEX.SHROUD_D], [0.62, HEX.GLOOM_D], [1, HEX.INK]]);
      c.fill();
      c.save();
      c.beginPath(); c.arc(0, 0, 47, 0, TAU); c.clip();
      c.fillStyle = radial(c, -22, -20, 40, [[0, rgba(HEX.RIM, 0.75)], [1, rgba(HEX.RIM, 0)]]);
      c.fillRect(-48, -48, 96, 96);
      c.strokeStyle = rgba(HEX.HFIRE, 0.65); c.lineWidth = 4;
      c.beginPath(); c.arc(0, 0, 44, 0, TAU); c.stroke();
      c.restore();
      c.lineWidth = 4; c.strokeStyle = OUT;
      c.beginPath(); c.arc(0, 0, 48, 0, TAU); c.stroke();
      c.strokeStyle = HEX.RIM; c.lineWidth = 2.5;
      c.beginPath(); c.arc(-6, -8, 36, Math.PI * 1.05, Math.PI * 1.75); c.stroke();
      // crown of corona, in front of the disc
      const crown = [18, 28, 16, 38, 22];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.32;
        const len = crown[i] * (atk === 2 ? 1.12 : 1);
        const x = Math.cos(a) * (48 + len), y = Math.sin(a) * (48 + len);
        const lx = Math.cos(a - 0.22) * 50, ly = Math.sin(a - 0.22) * 50;
        const rx = Math.cos(a + 0.18) * 50, ry = Math.sin(a + 0.18) * 50;
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(x, y); c.lineTo(rx, ry); c.closePath();
        c.fillStyle = lin(c, x, y, 0, 0, [[0, HEX.HFIRE_H], [0.5, HEX.HFIRE], [1, HEX.HFIRE_D]]);
        c.fill();
        c.lineWidth = 1.6; c.strokeStyle = OUT; c.stroke();
        circle(c, x, y, i === 2 ? 3.2 : 2.4, HEX.HGLARE, OUT, 1.4);
      }
      const eyeRy = 2.6 + Math.sin((f % WALK) / WALK * TAU) * 0.45 + (atk === 1 || atk === 2 ? 0.8 : 0);
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 16, 2); c.rotate(s * -0.3);
        ellipse(c, 0, 0, 6.2, eyeRy, HEX.HEYE, OUT, 1.4);
        ellipse(c, 0, 0, 2.2, eyeRy * 0.7, HEX.INK);
        circle(c, -2.2, -0.8, 1, HEX.WHITE);
        c.restore();
      }
      c.restore();
    });
  }

  function drawHollow() {
    for (let f = 0; f < WALK; f++) make('hollow' + f, 110, 120, (c) => {
      const t = f / WALK;
      const sway = Math.sin(t * TAU) * 7;
      const hem = Math.sin(t * TAU - 1) * 9;
      c.lineJoin = 'round'; c.lineCap = 'round';
      shadow(c, 55, 112, 28, 6, 0.28);
      const shroud = () => {
        c.beginPath();
        c.moveTo(55 + sway * 0.15, 6);
        c.bezierCurveTo(78 + sway, 10, 86 + sway * 0.4, 36, 96 + sway * 0.5, 70);
        c.bezierCurveTo(102 + sway * 0.3, 88, 90 + sway, 96, 84 + sway, 92);
        for (let i = 0; i < 5; i++) {
          const x = 84 - i * 14 + sway * 0.35;
          const lag = hem * (i % 2 ? 1 : -0.4);
          const drop = i === 1 ? 8 : i === 4 ? 6 : 0;
          c.lineTo(x - 3, 98 + lag + drop);
          c.lineTo(x - 14, 90 + lag * 0.25);
        }
        c.bezierCurveTo(14 + sway * 0.3, 78, 22, 28, 40, 12);
        c.quadraticCurveTo(48, 4, 55 + sway * 0.15, 6);
        c.closePath();
      };
      shroud();
      c.fillStyle = lin(c, 18, 6, 96, 110, [[0, HEX.SHROUD], [0.6, HEX.SHROUD], [1, HEX.SHROUD_D]]);
      c.fill();
      c.save(); shroud(); c.clip();
      c.fillStyle = rgba(HEX.SHROUD_D, 0.65);
      c.beginPath();
      c.moveTo(62 + sway, 20); c.quadraticCurveTo(78 + sway, 50, 70 + sway * 0.5, 92 + hem * 0.4);
      c.lineTo(58 + sway * 0.4, 90); c.quadraticCurveTo(60, 48, 50, 24); c.fill();
      c.fillStyle = rgba(HEX.WHITE, 0.18);
      c.beginPath();
      c.moveTo(36, 18); c.quadraticCurveTo(30, 48, 40 + sway * 0.3, 86);
      c.lineTo(32, 84); c.quadraticCurveTo(26, 46, 34, 16); c.fill();
      // violet hem, a cloth band along the tatters
      c.fillStyle = lin(c, 16, 88, 96, 112, [[0, HEX.ROSE], [1, HEX.ROSE_L]]);
      c.beginPath(); c.moveTo(20, 84);
      for (let i = 0; i < 5; i++) {
        const x = 84 - i * 14 + sway * 0.35;
        const lag = hem * (i % 2 ? 1 : -0.4);
        const drop = i === 1 ? 8 : i === 4 ? 6 : 0;
        c.lineTo(x - 3, 94 + lag + drop); c.lineTo(x - 14, 86 + lag * 0.25);
      }
      c.lineTo(20, 90); c.fill();
      c.restore();
      shroud();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      c.save(); shroud(); c.clip();
      c.lineWidth = 2.5; c.strokeStyle = HEX.RIM; c.stroke();
      c.restore();
      // skull
      c.beginPath();
      c.moveTo(55, 16);
      c.bezierCurveTo(80, 18, 82, 42, 74, 62);
      c.quadraticCurveTo(55, 78, 36, 62);
      c.bezierCurveTo(28, 42, 30, 18, 55, 16);
      c.fillStyle = lin(c, 30, 14, 82, 74, [[0, HEX.WHITE], [0.35, HEX.FROST_H], [1, HEX.FROST_L]]);
      c.fill();
      c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
      ellipse(c, 44, 28, 8, 4, rgba(HEX.WHITE, 0.55));
      ellipse(c, 42, 40, 6, 10, HEX.INK);
      ellipse(c, 68, 40, 6, 10, HEX.INK);
      circle(c, 40, 36, 1.4, HEX.GLOOM_L);
      circle(c, 66, 36, 1.4, HEX.GLOOM_L);
      c.beginPath();
      c.moveTo(55, 48); c.lineTo(51, 58); c.lineTo(59, 58); c.closePath();
      c.fillStyle = HEX.INK; c.fill();
      c.fillStyle = HEX.FROST_H;
      for (let i = 0; i < 4; i++) c.fillRect(46 + i * 4, 64, 2.4, 4 + (i % 2));
      c.strokeStyle = rgba(HEX.FROST_D, 0.8); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(48, 30); c.lineTo(52, 36); c.lineTo(49, 44); c.stroke();
    });
  }
}
