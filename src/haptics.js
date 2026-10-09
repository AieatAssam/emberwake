// Vibration feedback for touch devices (silently a no-op where unsupported, e.g. iOS Safari).
import { save } from './save.js';

const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
let lastAt = 0;

// pattern: ms or [on, off, on, ...]; throttled so swarms of hits never become a constant buzz
export function buzz(pattern, minGap = 90) {
  if (!supported || !save.settings.haptics) return;
  const now = performance.now();
  if (now - lastAt < minGap) return;
  lastAt = now;
  try { navigator.vibrate(pattern); } catch { /* ignore */ }
}
export const hapticsSupported = supported;
