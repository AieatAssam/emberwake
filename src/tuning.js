// Global balance knobs. Defaults are the shipped tuning; the dev simulator can override any of them
// per run (see devsim.js `tune` option) so balance sweeps need no code edits.
export const TUNE = {
  xp: 1, // multiplier on all experience gained
  enemyHp: 1, // enemy health (all kinds)
  bossHp: 1, // extra multiplier on boss health
  enemyDmg: 1, // enemy contact and projectile damage
  enemySpeed: 1,
  spawn: 1, // horde density (spawn rate and the alive-enemy floor)
  playerDmg: 1, // multiplier on weapon damage
  cinders: 1, // multiplier on every cinder income
  hpQuad: 1, // weight of the quadratic term in the enemy health curve
  hpLate: 1, // strength of the exponential tail after 15 minutes
  overcharge: 1, // power per Overcharge stack
};
export const TUNE_DEFAULTS = { ...TUNE };
