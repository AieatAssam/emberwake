// Keyboard, gamepad and touch-joystick input, merged into one movement vector.
const keys = new Set();
const pressed = new Set();
const touch = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
const JOY_R = 56, JOY_DEAD = 8;
let joyEl = null, knobEl = null;

export function initInput() {
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  joyEl = document.getElementById('joy');
  knobEl = document.getElementById('joy-knob');
  const canvasHost = document.getElementById('game');
  canvasHost.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || touch.active) return;
    touch.active = true; touch.id = e.pointerId;
    touch.ox = touch.x = e.clientX; touch.oy = touch.y = e.clientY;
    if (joyEl) { joyEl.style.display = 'block'; joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; }
  });
  addEventListener('pointermove', (e) => {
    if (!touch.active || e.pointerId !== touch.id) return;
    touch.x = e.clientX; touch.y = e.clientY;
    let dx = touch.x - touch.ox, dy = touch.y - touch.oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) {
      // dynamic stick: the base trails the thumb so you never run out of travel
      touch.ox += (dx / d) * (d - JOY_R); touch.oy += (dy / d) * (d - JOY_R);
      dx = touch.x - touch.ox; dy = touch.y - touch.oy;
      if (joyEl) { joyEl.style.left = touch.ox + 'px'; joyEl.style.top = touch.oy + 'px'; }
    }
    if (knobEl) knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const end = (e) => {
    if (e.pointerId !== touch.id) return;
    touch.active = false;
    if (joyEl) joyEl.style.display = 'none';
    if (knobEl) knobEl.style.transform = '';
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}

// Dev/test hook: when set, the bot's vector replaces keyboard, touch and gamepad movement.
let botVec = null;
export function setBotInput(v) {
  if (!v) { botVec = null; return; }
  const l = Math.hypot(v.x, v.y);
  botVec = l > 1 ? { x: v.x / l, y: v.y / l } : { x: v.x, y: v.y };
}

export function moveVector() {
  if (botVec) return botVec;
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    if (Math.hypot(ax, ay) > 0.2) { x += ax; y += ay; }
    if (p.buttons[12]?.pressed) y -= 1;
    if (p.buttons[13]?.pressed) y += 1;
    if (p.buttons[14]?.pressed) x -= 1;
    if (p.buttons[15]?.pressed) x += 1;
  }
  if (touch.active) {
    const dx = touch.x - touch.ox, dy = touch.y - touch.oy, d = Math.hypot(dx, dy);
    if (d > JOY_DEAD) { const m = Math.min(1, ((d - JOY_DEAD) / (JOY_R - JOY_DEAD)) * 1.15); x += (dx / d) * m; y += (dy / d) * m; }
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

let padFlarePrev = false, padPausePrev = false;
export function consumePressed(code) {
  if (pressed.has(code)) { pressed.delete(code); return true; }
  return false;
}
export function padButtons() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let flare = false, pause = false;
  for (const p of pads) {
    if (!p) continue;
    if (p.buttons[0]?.pressed || p.buttons[5]?.pressed) flare = true;
    if (p.buttons[9]?.pressed) pause = true;
  }
  const r = { flare: flare && !padFlarePrev, pause: pause && !padPausePrev };
  padFlarePrev = flare; padPausePrev = pause;
  return r;
}
export function clearPressed() { pressed.clear(); }

// Edge-triggered gamepad state for menu navigation (separate from in-run buttons)
let menuPrev = {};
export function padMenu() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const now = { up: false, down: false, left: false, right: false, a: false, b: false };
  for (const p of pads) {
    if (!p) continue;
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    now.up ||= !!p.buttons[12]?.pressed || ay < -0.6;
    now.down ||= !!p.buttons[13]?.pressed || ay > 0.6;
    now.left ||= !!p.buttons[14]?.pressed || ax < -0.6;
    now.right ||= !!p.buttons[15]?.pressed || ax > 0.6;
    now.a ||= !!p.buttons[0]?.pressed;
    now.b ||= !!p.buttons[1]?.pressed;
  }
  const out = {};
  for (const k in now) out[k] = now[k] && !menuPrev[k];
  menuPrev = now;
  return out;
}
