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
  cinders: 0.2, // multiplier on cinders picked up during a run (the end-of-run bonus is separate)
  hpQuad: 1, // weight of the quadratic term in the enemy health curve
  hpLate: 1, // strength of the exponential tail after 15 minutes
  overcharge: 1, // power per Overcharge stack
  xpCurve: 2.5, // how steeply level cost grows after level 12 (0 = flat)
  chestBig: 0.5, // chance of 3- and 5-item chests
  eliteChest: 0.6, // chance a slain elite drops a chest
  metaPower: 0.5, // strength of Hearth stat upgrades (whole-number upgrades like Twin Flame are unaffected)
  hpMid: 7, // extra enemy health from minute 4, growing to (1+hpMid)x by minute 15
  dmgMid: 0.8, // extra enemy damage on the same ramp
  eliteEvery: 1.4, // multiplier on the gap between periodic elites
};
export const TUNE_DEFAULTS = { ...TUNE };
