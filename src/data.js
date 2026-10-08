// All Emberwake game data. Tuning lives here.

export const MAX_WEAPON_LEVEL = 8;
export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

export const BASE_STATS = {
  maxHp: 100, regen: 0, armor: 0, moveSpeed: 150,
  might: 1, area: 1, projSpeed: 1, duration: 1, amount: 0, cooldown: 1,
  magnet: 95, luck: 1, growth: 1, greed: 1, crit: 0.05, critMul: 2,
  flareGain: 1, revivals: 0, curse: 1, enemyHp: 1, enemySpeed: 1, noHeal: false, overcharge: 0,
  rerolls: 0, banishes: 0, skips: 0,
};

// Level deltas: dmg/amount/pierce/chains are additive, area/speed/duration additive fractions,
// cdMul multiplicative. freeze is additive chance.
const L = (...ls) => ls;

export const WEAPONS = {
  emberBolt: {
    name: 'Ember Bolt', element: 'fire', behavior: 'bolt',
    desc: 'Hurls seeking fireballs at the nearest foe.',
    base: { dmg: 11, cd: 0.8, amount: 1, speed: 460, pierce: 1, area: 1, duration: 1.6, knock: 6 },
    levels: L({ amount: 1 }, { dmg: 5 }, { amount: 1, cdMul: 0.9 }, { pierce: 1 }, { amount: 1 }, { dmg: 8 }, { amount: 1, pierce: 1 }),
  },
  haloBlades: {
    name: 'Halo Sickles', element: 'steel', behavior: 'orbit',
    desc: 'Silver sickles circle you, carving through the swarm.',
    base: { dmg: 9, cd: 3.2, amount: 2, speed: 1, area: 1, duration: 2.6, knock: 8 },
    levels: L({ amount: 1 }, { dmg: 5, area: 0.15 }, { amount: 1 }, { duration: 0.6, speed: 0.25 }, { amount: 1 }, { dmg: 7, area: 0.15 }, { amount: 1, duration: 1 }),
  },
  stormCoil: {
    name: 'Storm Coil', element: 'storm', behavior: 'chain',
    desc: 'Calls lightning that leaps between enemies.',
    base: { dmg: 13, cd: 1.5, amount: 1, chains: 2, area: 1, knock: 2 },
    levels: L({ chains: 1 }, { dmg: 6 }, { amount: 1 }, { chains: 1, cdMul: 0.9 }, { amount: 1 }, { dmg: 10 }, { chains: 2, amount: 1 }),
  },
  frostPulse: {
    name: 'Rime Pulse', element: 'frost', behavior: 'pulse',
    desc: 'A freezing shockwave bursts outward, chilling everything.',
    base: { dmg: 13, cd: 2.2, area: 1, duration: 1.6, freeze: 0, knock: 14 },
    levels: L({ area: 0.15 }, { dmg: 7 }, { cdMul: 0.85 }, { area: 0.2, freeze: 0.1 }, { dmg: 7 }, { cdMul: 0.85 }, { area: 0.25, dmg: 8, freeze: 0.15 }),
  },
  wispSwarm: {
    name: 'Wisp Swarm', element: 'spirit', behavior: 'wisp',
    desc: 'Releases hungry wisps that hunt on their own.',
    base: { dmg: 7, cd: 1.35, amount: 2, speed: 270, duration: 3, pierce: 1, area: 1, knock: 3 },
    levels: L({ amount: 1 }, { dmg: 4 }, { amount: 1 }, { pierce: 1, speed: 0.2 }, { amount: 2 }, { dmg: 6 }, { amount: 2, cdMul: 0.85 }),
  },
  crescentArc: {
    name: 'Crescent Arc', element: 'steel', behavior: 'arc',
    desc: 'A brutal sweeping cleave in the direction you face.',
    base: { dmg: 17, cd: 1.2, amount: 1, area: 1, knock: 16 },
    levels: L({ amount: 1 }, { dmg: 6 }, { area: 0.15 }, { cdMul: 0.9, dmg: 6 }, { area: 0.15 }, { amount: 1 }, { dmg: 12, area: 0.2 }),
  },
  starfall: {
    name: 'Starfall', element: 'fire', behavior: 'meteor',
    desc: 'Drags burning stars from the dead sky onto your foes.',
    base: { dmg: 32, cd: 2.5, amount: 1, area: 1, knock: 20 },
    levels: L({ amount: 1 }, { dmg: 12 }, { area: 0.2 }, { amount: 1, cdMul: 0.9 }, { dmg: 15 }, { amount: 1 }, { amount: 2, area: 0.25 }),
  },
  moonglaive: {
    name: 'Moonglaive', element: 'spirit', behavior: 'glaive',
    desc: 'A spinning glaive that sails out and returns to your hand.',
    base: { dmg: 14, cd: 2.1, amount: 1, speed: 400, area: 1, duration: 1, knock: 10 },
    levels: L({ amount: 1 }, { dmg: 6 }, { area: 0.2, speed: 0.15 }, { amount: 1 }, { dmg: 8 }, { cdMul: 0.85, area: 0.2 }, { amount: 2 }),
  },
  prismBeam: {
    name: 'Prism Beam', element: 'spirit', behavior: 'beam',
    desc: 'Sweeping beams of split light rotate around you.',
    base: { dmg: 7, cd: 4, amount: 1, area: 1, duration: 2.2, speed: 1, knock: 1 },
    levels: L({ amount: 1 }, { dmg: 3 }, { duration: 0.6 }, { amount: 1, area: 0.15 }, { dmg: 4 }, { duration: 1 }, { amount: 2, area: 0.2 }),
  },
  bloomMines: {
    name: 'Bloom Mines', element: 'nature', behavior: 'mine',
    desc: 'Plants volatile blossoms that erupt when stepped on.',
    base: { dmg: 30, cd: 1.7, amount: 1, area: 1, duration: 8, knock: 18 },
    levels: L({ amount: 1 }, { dmg: 10 }, { area: 0.2 }, { amount: 1, cdMul: 0.9 }, { dmg: 12 }, { amount: 1 }, { amount: 2, area: 0.25 }),
  },
  sparkDrones: {
    name: 'Spark Drones', element: 'storm', behavior: 'drone',
    desc: 'Brass drones hover nearby and pepper enemies with sparks.',
    base: { dmg: 8, cd: 0.55, amount: 1, speed: 560, pierce: 1, area: 1, knock: 2 },
    levels: L({ amount: 1 }, { dmg: 3 }, { cdMul: 0.85 }, { amount: 1 }, { pierce: 1, dmg: 3 }, { cdMul: 0.85 }, { amount: 2 }),
  },
  sunRing: {
    name: 'Sunring', element: 'fire', behavior: 'aura',
    desc: 'A ring of living flame scorches anything that comes close.',
    base: { dmg: 5, cd: 0.5, area: 1, knock: 3 },
    levels: L({ area: 0.15 }, { dmg: 3 }, { cdMul: 0.9 }, { area: 0.15 }, { dmg: 4 }, { cdMul: 0.85, area: 0.15 }, { dmg: 6, area: 0.2 }),
  },
  iceLance: {
    name: 'Rime Lance', element: 'frost', behavior: 'lance',
    desc: 'Fires piercing icicles the way you move. Chills on hit.',
    base: { dmg: 12, cd: 0.8, amount: 1, speed: 620, pierce: 3, area: 1, duration: 1.2, knock: 4 },
    levels: L({ amount: 1 }, { dmg: 5 }, { pierce: 2 }, { amount: 1, cdMul: 0.9 }, { dmg: 7 }, { amount: 1 }, { amount: 2, pierce: 3 }),
  },
  gravewell: {
    name: 'Gravewell', element: 'void', behavior: 'vortex',
    desc: 'Opens a vortex in the horde that drags foes inward, grinds them, then implodes.',
    base: { dmg: 4, cd: 4.8, amount: 1, area: 1, duration: 2.2, knock: 0 },
    levels: L({ dmg: 1 }, { area: 0.15 }, { duration: 0.5 }, { amount: 1 }, { dmg: 2, cdMul: 0.92 }, { area: 0.2 }, { amount: 1, dmg: 2 }),
  },
  sanctum: {
    name: 'Sanctum Quills', element: 'holy', behavior: 'radial',
    desc: 'Bursts of radiant quills fan out in every direction.',
    base: { dmg: 9, cd: 1.6, amount: 6, speed: 380, pierce: 1, area: 1, duration: 1.1, knock: 5 },
    levels: L({ amount: 2 }, { dmg: 4 }, { pierce: 1 }, { amount: 2, cdMul: 0.9 }, { dmg: 6 }, { amount: 2 }, { amount: 4, pierce: 1 }),
  },
};

// Fusions: two maxed weapons merge at the next chest into an Ascended weapon (freeing a slot!).
// Each part keeps its parent's behavior at max level, then gets boosted.
export const FUSIONS = {
  cataclysm: {
    name: 'Cataclysm Comet', parents: ['emberBolt', 'starfall'],
    desc: 'Fireballs detonate on impact and the sky never stops falling.',
    boost: { emberBolt: { dmgMul: 1.8, amount: 2, explode: 70 }, starfall: { dmgMul: 1.7, amount: 3, areaMul: 1.3, cdMul: 0.75 } },
  },
  thousandEdges: {
    name: 'Thousand Edges', parents: ['haloBlades', 'crescentArc'],
    desc: 'An eternal storm of blades and a cleave that hits all around.',
    boost: { haloBlades: { dmgMul: 1.8, amount: 4, areaMul: 1.3, permanent: true }, crescentArc: { dmgMul: 1.7, amount: 2, areaMul: 1.3 } },
  },
  tempestHeart: {
    name: 'Tempest Heart', parents: ['stormCoil', 'frostPulse'],
    desc: 'Every frozen pulse crackles with chain lightning.',
    boost: { stormCoil: { dmgMul: 2, amount: 3, chains: 3, cdMul: 0.7 }, frostPulse: { dmgMul: 2, areaMul: 1.35, freeze: 0.3, cdMul: 0.8, zap: true } },
  },
  seraphChoir: {
    name: 'Seraph Choir', parents: ['wispSwarm', 'prismBeam'],
    desc: 'Endless prismatic beams and wisps that burst into light.',
    boost: { wispSwarm: { dmgMul: 2, amount: 4, explode: 45 }, prismBeam: { dmgMul: 1.8, amount: 2, areaMul: 1.25, permanent: true } },
  },
  eclipseDisc: {
    name: 'Eclipse Disc', parents: ['moonglaive', 'sunRing'],
    desc: 'Black-sun glaives orbit inside a blazing corona.',
    boost: { moonglaive: { dmgMul: 2, amount: 2, areaMul: 1.5, pierceAll: true }, sunRing: { dmgMul: 2.2, areaMul: 1.5 } },
  },
  hiveFoundry: {
    name: 'Hive Foundry', parents: ['bloomMines', 'sparkDrones'],
    desc: 'A drone wing that seeds the ground with blossoms.',
    boost: { sparkDrones: { dmgMul: 1.8, amount: 2, cdMul: 0.7 }, bloomMines: { dmgMul: 1.8, amount: 3, areaMul: 1.2 } },
  },
  glacierSpire: {
    name: 'Glacier Spire', parents: ['iceLance', 'sanctum'],
    desc: 'Radiant ice erupts in every direction, freezing solid.',
    boost: { iceLance: { dmgMul: 1.9, amount: 3, freeze: 0.25 }, sanctum: { dmgMul: 1.8, amount: 8, pierce: 3, freeze: 0.2 } },
  },
  eventHorizon: {
    name: 'Event Horizon', parents: ['gravewell', 'starfall'],
    desc: 'Vortices drag the horde into a single knot while the sky falls on it.',
    boost: { gravewell: { dmgMul: 1.8, amount: 2, areaMul: 1.3 }, starfall: { dmgMul: 1.7, amount: 3, areaMul: 1.25, cdMul: 0.8 } },
  },
};

export const PASSIVES = {
  might: { name: 'Ember Heart', desc: '+10% damage', max: 5, apply: (s, l) => (s.might += 0.1 * l) },
  haste: { name: 'Quicksilver', desc: '-7% weapon cooldowns', max: 5, apply: (s, l) => (s.cooldown *= Math.pow(0.93, l)) },
  reach: { name: 'Wide Lens', desc: '+10% area', max: 5, apply: (s, l) => (s.area += 0.1 * l) },
  velocity: { name: 'Gale Feather', desc: '+12% projectile speed', max: 5, apply: (s, l) => (s.projSpeed += 0.12 * l) },
  multicast: { name: 'Echo Shard', desc: '+1 projectile on every weapon', max: 2, apply: (s, l) => (s.amount += l) },
  vitality: { name: 'Iron Root', desc: '+20 max health', max: 5, apply: (s, l) => (s.maxHp += 20 * l) },
  regen: { name: 'Living Moss', desc: '+0.4 health/sec', max: 5, apply: (s, l) => (s.regen += 0.4 * l) },
  swift: { name: 'Wind Boots', desc: '+10% move speed', max: 5, apply: (s, l) => (s.moveSpeed *= 1 + 0.1 * l) },
  magnet: { name: 'Lodestone', desc: '+30% pickup radius', max: 5, apply: (s, l) => (s.magnet *= 1 + 0.3 * l) },
  luck: { name: 'Lucky Bone', desc: '+10% luck (crits, drops, chests)', max: 5, apply: (s, l) => (s.luck += 0.1 * l) },
  crit: { name: 'Hawk Eye', desc: '+5% crit chance, +15% crit damage', max: 5, apply: (s, l) => { s.crit += 0.05 * l; s.critMul += 0.15 * l; } },
  duration: { name: 'Hourglass', desc: '+12% effect duration', max: 5, apply: (s, l) => (s.duration += 0.12 * l) },
  armor: { name: 'Bark Plate', desc: '+1 armor, +3% damage taken reduction', max: 5, apply: (s, l) => (s.armor += l) },
  growth: { name: 'Sage Tome', desc: '+8% experience', max: 5, apply: (s, l) => (s.growth += 0.08 * l) },
  greed: { name: 'Gilded Tooth', desc: '+15% cinders', max: 5, apply: (s, l) => (s.greed += 0.15 * l) },
};

// Dark Pacts: rare, risky draft cards. Max 3 per run.
export const PACTS = {
  hunger: { name: 'Pact of Hunger', desc: '+40% enemy spawns · +25% damage · +20% XP', apply: (s) => { s.curse += 0.4; s.might += 0.25; s.growth += 0.2; } },
  glass: { name: 'Pact of Glass', desc: '-35% max health · +45% damage · +10% crit', apply: (s) => { s.maxHp *= 0.65; s.might += 0.45; s.crit += 0.1; } },
  frenzy: { name: 'Pact of Frenzy', desc: 'Enemies +20% speed · -18% cooldowns · +10% move', apply: (s) => { s.enemySpeed *= 1.2; s.cooldown *= 0.82; s.moveSpeed *= 1.1; } },
  avarice: { name: 'Pact of Avarice', desc: '+50% enemy health · +100% cinders · +30% luck', apply: (s) => { s.enemyHp += 0.5; s.greed += 1; s.luck += 0.3; } },
  ashes: { name: 'Pact of Ashes', desc: 'Healing pickups vanish · +1 projectile · +20% area', apply: (s) => { s.noHeal = true; s.amount += 1; s.area += 0.2; } },
};

export const CHARACTERS = {
  warden: {
    name: 'Kael', title: 'The Ashen Warden', sprite: 'warden', weapon: 'emberBolt', cost: 0,
    bonus: '+10% damage', apply: (s) => { s.might += 0.1; s.maxHp += 10; },
    flare: 'supernova', flareName: 'Supernova', flareDesc: 'Detonate the Ember: a colossal ring of fire.',
    color: '#ff9a3a',
  },
  oracle: {
    name: 'Ysolde', title: 'The Rime Oracle', sprite: 'oracle', weapon: 'frostPulse', cost: 250,
    bonus: '+15% area, +10% duration', apply: (s) => { s.area += 0.15; s.duration += 0.1; s.maxHp -= 10; },
    flare: 'absoluteZero', flareName: 'Absolute Zero', flareDesc: 'Freeze every enemy solid for 5s; frozen foes shatter for double damage.',
    color: '#8ae0ff',
  },
  tinker: {
    name: 'Pip', title: 'The Clockwork Tinker', sprite: 'tinker', weapon: 'sparkDrones', cost: 500,
    bonus: '-10% cooldowns, +15% projectile speed', apply: (s) => { s.cooldown *= 0.9; s.projSpeed += 0.15; s.maxHp -= 10; },
    flare: 'overclock', flareName: 'Overclock', flareDesc: 'All weapons fire 3x faster for 7s.',
    color: '#7ef0c0',
  },
  reaver: {
    name: 'Grahm', title: 'The Blood Reaver', sprite: 'reaver', weapon: 'crescentArc', cost: 800,
    bonus: '+40 health, +1 armor, +0.5 regen', apply: (s) => { s.maxHp += 40; s.armor += 1; s.regen += 0.5; s.moveSpeed *= 0.95; },
    flare: 'bloodrage', flareName: 'Bloodrage', flareDesc: 'Double damage, +30% speed and lifesteal for 8s.',
    color: '#ff4a5a',
  },
  dancer: {
    name: 'Lune', title: 'The Moon Dancer', sprite: 'dancer', weapon: 'moonglaive', cost: 1200,
    bonus: '+20% move speed, +20% luck', apply: (s) => { s.moveSpeed *= 1.2; s.luck += 0.2; s.maxHp -= 15; },
    flare: 'moonfall', flareName: 'Moonfall', flareDesc: 'Twelve glaives spiral out, then you blink untouchable for 3s.',
    color: '#c9a0ff',
  },
  bellwright: {
    name: 'Brannoc', title: 'The Bellwright', sprite: 'bellwright', weapon: 'gravewell', cost: 1600,
    bonus: '+25% max health, +15% area, -10% move speed', apply: (s) => { s.maxHp *= 1.25; s.area += 0.15; s.moveSpeed *= 0.9; },
    flare: 'toll', flareName: 'Great Toll', flareDesc: 'Ring the bell: every foe on screen is stunned for 2s and struck by three rings of sound.',
    color: '#ffb347',
  },
};

// tex: base frame name (frames 0/1 animate). r = collision radius.
export const ENEMIES = {
  gloomling: { tex: 'gloomling', hp: 9, speed: 52, dmg: 5, xp: 1, r: 13 },
  moth: { tex: 'moth', hp: 6, speed: 92, dmg: 5, xp: 1, r: 12, wobble: true, anim: 10 },
  husk: { tex: 'husk', hp: 48, speed: 38, dmg: 13, xp: 4, r: 21, knockRes: 0.6 },
  wraith: { tex: 'wraith', hp: 20, speed: 68, dmg: 9, xp: 2, r: 15, alpha: 0.88 },
  splitter: { tex: 'splitter', hp: 28, speed: 46, dmg: 8, xp: 2, r: 17, split: 'broodling', splitCount: 3 },
  broodling: { tex: 'broodling', hp: 7, speed: 84, dmg: 4, xp: 1, r: 9, anim: 12 },
  beetle: { tex: 'beetle', hp: 34, speed: 50, dmg: 14, xp: 3, r: 18, charge: true, knockRes: 0.4 },
  spitter: { tex: 'spitter', hp: 24, speed: 40, dmg: 8, xp: 3, r: 16, ranged: true },
  sentinel: { tex: 'sentinel', hp: 140, speed: 44, dmg: 18, xp: 10, r: 23, knockRes: 0.8 },
  matron: { tex: 'matron', hp: 4200, speed: 58, dmg: 20, xp: 250, r: 58, boss: true, knockRes: 1, summon: 'broodling' },
  colossus: { tex: 'colossus', hp: 16000, speed: 46, dmg: 40, xp: 600, r: 75, boss: true, knockRes: 1, slam: true },
  tyrant: { tex: 'tyrant', hp: 90000, speed: 62, dmg: 60, xp: 2500, r: 85, boss: true, knockRes: 1, nova: true, final: true },
  imp: { tex: 'imp', hp: 16, speed: 78, dmg: 8, xp: 2, r: 13, anim: 8, deathBurst: true },
  frostwisp: { tex: 'frostwisp', hp: 22, speed: 60, dmg: 6, xp: 2, r: 14, wobble: true, chill: true, alpha: 0.92 },
  lurker: { tex: 'lurker', hp: 38, speed: 58, dmg: 8, xp: 3, r: 17, submerge: true, anim: 0 },
  totem: { tex: 'totem', hp: 20, speed: 0, dmg: 0, xp: 0, r: 16, inert: true },
};

// The Director: timeline (seconds). rate = spawns/sec, min = floor of alive enemies.
export const WAVES = [
  { at: 0, rate: 1.2, min: 10, pool: { gloomling: 1 } },
  { at: 30, rate: 2.4, min: 25, pool: { gloomling: 3, moth: 1 } },
  { at: 60, rate: 2.4, min: 30, pool: { gloomling: 2, moth: 2 } },
  { at: 105, rate: 3, min: 42, pool: { gloomling: 2, moth: 2, husk: 1 } },
  { at: 150, rate: 3.8, min: 55, pool: { moth: 2, wraith: 2, husk: 1 } },
  { at: 210, rate: 6, min: 90, pool: { gloomling: 2, splitter: 1.5, wraith: 2 } },
  { at: 270, rate: 8, min: 120, pool: { wraith: 2, splitter: 1, spitter: 0.5, husk: 1 } },
  { at: 330, rate: 12, min: 195, pool: { gloomling: 3, beetle: 1.5, spitter: 1 } },
  { at: 400, rate: 14.2, min: 225, pool: { moth: 3, husk: 2, beetle: 1 } },
  { at: 460, rate: 16.5, min: 262, pool: { wraith: 3, splitter: 2, spitter: 1.5 } },
  { at: 530, rate: 18.8, min: 300, pool: { husk: 2, beetle: 2, moth: 3, sentinel: 0.3 } },
  { at: 600, rate: 21, min: 345, pool: { gloomling: 3, wraith: 2, sentinel: 0.6, spitter: 1 } },
  { at: 680, rate: 24, min: 390, pool: { splitter: 2, beetle: 2, husk: 2, sentinel: 0.8 } },
  { at: 760, rate: 27, min: 450, pool: { moth: 4, wraith: 3, sentinel: 1, spitter: 1 } },
  { at: 830, rate: 31.5, min: 510, pool: { husk: 3, beetle: 2, sentinel: 1.5, splitter: 2 } },
  { at: 900, rate: 36, min: 570, pool: { gloomling: 2, moth: 2, husk: 2, wraith: 2, splitter: 2, beetle: 2, spitter: 1, sentinel: 2 } },
];

export const EVENTS = [
  { at: 75, type: 'ring', enemy: 'moth', count: 36 },
  { at: 90, type: 'elite', enemy: 'husk' },
  { at: 140, type: 'stampede', enemy: 'beetle', count: 0, alt: 'gloomling', altCount: 30 },
  { at: 180, type: 'elite', enemy: 'wraith' },
  { at: 240, type: 'ring', enemy: 'wraith', count: 48 },
  { at: 270, type: 'elite', enemy: 'splitter' },
  { at: 300, type: 'boss', enemy: 'matron' },
  { at: 360, type: 'stampede', enemy: 'beetle', count: 26 },
  { at: 390, type: 'elite', enemy: 'beetle' },
  { at: 450, type: 'ring', enemy: 'husk', count: 40 },
  { at: 480, type: 'elite', enemy: 'spitter' },
  { at: 540, type: 'stampede', enemy: 'moth', count: 60 },
  { at: 570, type: 'elite', enemy: 'sentinel' },
  { at: 600, type: 'boss', enemy: 'colossus' },
  { at: 660, type: 'ring', enemy: 'beetle', count: 56 },
  { at: 690, type: 'elite', enemy: 'husk' },
  { at: 720, type: 'stampede', enemy: 'wraith', count: 70 },
  { at: 750, type: 'elite', enemy: 'sentinel' },
  { at: 780, type: 'ring', enemy: 'sentinel', count: 30 },
  { at: 810, type: 'elite', enemy: 'beetle' },
  { at: 840, type: 'stampede', enemy: 'husk', count: 60 },
  { at: 870, type: 'elite', enemy: 'sentinel' },
  { at: 900, type: 'boss', enemy: 'tyrant' },
];

// Hearth: permanent upgrades bought with cinders
export const META = {
  might: { name: 'Kindled Strength', desc: '+5% damage', max: 5, cost: 60, apply: (s, l) => (s.might += 0.05 * l) },
  vitality: { name: 'Hearthblood', desc: '+10 max health', max: 5, cost: 50, apply: (s, l) => (s.maxHp += 10 * l) },
  armor: { name: 'Ashen Skin', desc: '+1 armor', max: 3, cost: 120, apply: (s, l) => (s.armor += l) },
  regen: { name: 'Warm Hearth', desc: '+0.2 health/sec', max: 5, cost: 70, apply: (s, l) => (s.regen += 0.2 * l) },
  haste: { name: 'Clockwork Pulse', desc: '-3% cooldowns', max: 5, cost: 90, apply: (s, l) => (s.cooldown *= Math.pow(0.97, l)) },
  area: { name: 'Widening Glow', desc: '+5% area', max: 4, cost: 80, apply: (s, l) => (s.area += 0.05 * l) },
  swift: { name: 'Fleet Foot', desc: '+5% move speed', max: 3, cost: 70, apply: (s, l) => (s.moveSpeed *= 1 + 0.05 * l) },
  magnet: { name: 'Pull of the Flame', desc: '+20% pickup radius', max: 3, cost: 50, apply: (s, l) => (s.magnet *= 1 + 0.2 * l) },
  growth: { name: 'Old Lore', desc: '+5% experience', max: 5, cost: 80, apply: (s, l) => (s.growth += 0.05 * l) },
  greed: { name: 'Ember Hoard', desc: '+10% cinders', max: 5, cost: 60, apply: (s, l) => (s.greed += 0.1 * l) },
  luck: { name: 'Fortune', desc: '+5% luck', max: 4, cost: 90, apply: (s, l) => (s.luck += 0.05 * l) },
  flare: { name: 'Flarecraft', desc: '+12% flare charge rate', max: 4, cost: 100, apply: (s, l) => (s.flareGain += 0.12 * l) },
  amount: { name: 'Twin Flame', desc: '+1 projectile on every weapon', max: 1, cost: 1500, apply: (s, l) => (s.amount += l) },
  revival: { name: 'Second Wick', desc: 'Revive once at 50% health', max: 2, cost: 600, apply: (s, l) => (s.revivals += l) },
  reroll: { name: 'Shuffle', desc: '+2 rerolls per run', max: 3, cost: 120, apply: (s, l) => (s.rerolls += 2 * l) },
  banish: { name: 'Exile', desc: '+1 banish per run', max: 3, cost: 150, apply: (s, l) => (s.banishes += l) },
};

export function xpForLevel(level) {
  // XP to go from `level` to `level+1`
  if (level < 20) return Math.floor(4 + level * 4);
  if (level < 40) return Math.floor(84 + (level - 20) * 14);
  return Math.floor(364 + (level - 40) * 42);
}

export function enemyHpScale(t) {
  const m = t / 60;
  let s = 1 + 0.2 * m + 0.032 * m * m;
  if (m > 15) s *= Math.pow(1.17, m - 15);
  return s;
}

export function describeLevel(delta) {
  const parts = [];
  for (const k in delta) {
    const v = delta[k];
    switch (k) {
      case 'amount': parts.push(`+${v} projectile${v > 1 ? 's' : ''}`); break;
      case 'dmg': parts.push(`+${v} damage`); break;
      case 'pierce': parts.push(`+${v} pierce`); break;
      case 'chains': parts.push(`+${v} chain jump${v > 1 ? 's' : ''}`); break;
      case 'area': parts.push(`+${Math.round(v * 100)}% area`); break;
      case 'speed': parts.push(`+${Math.round(v * 100)}% speed`); break;
      case 'duration': parts.push(`+${v}s duration`); break;
      case 'cdMul': parts.push(`-${Math.round((1 - v) * 100)}% cooldown`); break;
      case 'freeze': parts.push(`+${Math.round(v * 100)}% freeze chance`); break;
    }
  }
  return parts.join(', ');
}

export function weaponStatsAt(id, level) {
  const w = WEAPONS[id];
  const s = { ...w.base };
  for (let i = 0; i < level - 1 && i < w.levels.length; i++) {
    const d = w.levels[i];
    for (const k in d) {
      if (k === 'cdMul') s.cd *= d[k];
      else if (k === 'duration') s.duration = (s.duration || 0) + d[k];
      else s[k] = (s[k] || 0) + d[k];
    }
  }
  return s;
}

export function fusionFor(a, b) {
  for (const id in FUSIONS) {
    const p = FUSIONS[id].parents;
    if ((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)) return id;
  }
  return null;
}
// every fusion a weapon can join (a weapon may have more than one recipe)
export function fusionPartnersOf(id) {
  const out = [];
  for (const fid in FUSIONS) {
    const p = FUSIONS[fid].parents;
    if (p[0] === id) out.push({ fusion: fid, partner: p[1] });
    else if (p[1] === id) out.push({ fusion: fid, partner: p[0] });
  }
  return out;
}
export function fusionPartnerOf(id) {
  for (const fid in FUSIONS) {
    const p = FUSIONS[fid].parents;
    if (p[0] === id) return { fusion: fid, partner: p[1] };
    if (p[1] === id) return { fusion: fid, partner: p[0] };
  }
  return null;
}

// Feats: one-time achievements that pay cinders. check(g) runs live during a run.
export const FEATS = {
  firstBlood: { name: 'First Embers', desc: 'Slay 500 foes in one run', reward: 40, check: (g) => g.kills >= 500 },
  massacre: { name: 'Gloamcleaver', desc: 'Slay 5,000 foes in one run', reward: 150, check: (g) => g.kills >= 5000 },
  annihilation: { name: 'Unmaker', desc: 'Slay 25,000 foes in one run', reward: 400, check: (g) => g.kills >= 25000 },
  survive5: { name: 'Still Burning', desc: 'Survive 5 minutes', reward: 50, check: (g) => g.time >= 300 },
  survive10: { name: 'Long Night', desc: 'Survive 10 minutes', reward: 150, check: (g) => g.time >= 600 },
  kindle2: { name: 'Wildfire', desc: 'Reach Kindle x2', reward: 80, check: (g) => g.kindleTier >= 5 },
  level50: { name: 'Ascendant', desc: 'Reach level 50', reward: 120, check: (g) => g.level >= 50 },
  fusion: { name: 'Alchemist', desc: 'Forge an Ascended weapon', reward: 150, check: (g) => g.weapons.some((w) => w.fused) },
  twoFusions: { name: 'Twin Suns', desc: 'Hold two Ascended weapons at once', reward: 300, check: (g) => g.weapons.filter((w) => w.fused).length >= 2 },
  pacts3: { name: 'Blood Debtor', desc: 'Swear three Dark Pacts in one run', reward: 200, check: (g) => g.pacts.length >= 3 },
  matron: { name: 'Broodbreaker', desc: 'Slay the Brood Matron', reward: 120, check: (g) => g.bossKills.matron },
  colossus: { name: 'Quench the Forge', desc: 'Slay the Cinder Colossus', reward: 250, check: (g) => g.bossKills.colossus },
  tyrant: { name: 'Dawnbringer', desc: 'Slay the Eclipse Tyrant', reward: 600, check: (g) => g.bossKills.tyrant },
  overcharge25: { name: 'Beyond the Limit', desc: 'Stack 25 Overcharges', reward: 300, check: (g) => (g.overcharge || 0) >= 25 },
  untouched: { name: 'Ghost of the Gloam', desc: 'Reach 3:00 without taking damage', reward: 150, check: (g) => g.time >= 180 && !g.dmgLog },
};

// Stages: same Director timeline, different ground, enemy mix and risk/reward.
export const STAGES = {
  gloam: {
    name: 'The Gloam', desc: 'Moss-choked ruins at the edge of the dark. Where every Bearer begins.',
    cost: 0, hpMul: 1, greedMul: 1, speedMul: 1, bias: {},
    ground: { base: '#141a24', blobs: ['rgba(30,44,52,0.5)', 'rgba(26,30,46,0.6)', 'rgba(36,38,40,0.35)', 'rgba(20,40,38,0.45)'], stone: 'rgba(60,62,80,0.35)' },
    tint: 0xb8b8d0, decorTint: 0xffffff, color: '#8ab0ff',
    decor: { grass: 25, rock1: 17, rock0: 13, flower: 13, shroom: 12, bones: 12, pillar: 8 },
  },
  ashfields: {
    name: 'The Ashfields', desc: 'Scorched plains where husks and ram beetles stampede. +40% enemy health, +50% cinders.',
    cost: 600, hpMul: 1.4, greedMul: 1.5, speedMul: 1, bias: { husk: 1.5, beetle: 1.5, spitter: 0.5, imp: 1.4 },
    ground: { base: '#1e1410', blobs: ['rgba(70,36,20,0.45)', 'rgba(40,24,20,0.6)', 'rgba(90,50,20,0.25)', 'rgba(30,20,18,0.5)'], stone: 'rgba(90,64,50,0.35)' },
    tint: 0xd8b8a0, decorTint: 0xffb890, color: '#ff8a4a',
    decor: { stump: 20, vent: 14, basalt: 22, rock1: 16, bones: 16, pillar: 6 }, own: ['stump', 'vent', 'basalt'],
  },
  rimewood: {
    name: 'The Rimewood', desc: 'A frozen forest where wraiths drift between the trees. +80% enemy health, +15% enemy speed, x2 cinders.',
    cost: 1500, hpMul: 1.8, greedMul: 2, speedMul: 1.15, bias: { wraith: 1.6, moth: 0.8, sentinel: 0.6, frostwisp: 1.6 },
    ground: { base: '#101a24', blobs: ['rgba(60,90,120,0.4)', 'rgba(30,50,70,0.55)', 'rgba(120,150,180,0.18)', 'rgba(20,40,60,0.5)'], stone: 'rgba(110,130,160,0.35)' },
    tint: 0xc0d8ee, decorTint: 0xa8d8ff, color: '#a8e0ff',
    decor: { pine: 18, icecluster: 18, snowrock: 22, rock1: 14, grass: 14, pillar: 6 }, own: ['pine', 'icecluster', 'snowrock'],
  },
  marsh: {
    name: 'The Drowned Marsh', desc: 'A black bog where lurkers sink and surface at your heels. +110% enemy health, +10% speed, x2.5 cinders.',
    cost: 2500, hpMul: 2.1, greedMul: 2.5, speedMul: 1.1, bias: { lurker: 1.8, splitter: 1, spitter: 0.6, moth: 0.6 },
    ground: { base: '#0e1612', blobs: ['rgba(30,60,44,0.55)', 'rgba(20,34,30,0.6)', 'rgba(60,90,60,0.22)', 'rgba(10,30,30,0.55)'], stone: 'rgba(60,80,64,0.3)' },
    tint: 0xa8c8b0, decorTint: 0xb0e0c0, color: '#8ad8a0',
    decor: { reeds: 24, lilypad: 18, sunklantern: 8, rock1: 14, bones: 14, grass: 14, pillar: 4 }, own: ['reeds', 'lilypad', 'sunklantern'],
  },
};

// Bestiary lore (original). Keys match ENEMIES.
export const BESTIARY = {
  gloomling: { name: 'Gloomling', lore: 'Oily scraps of the dark given hunger. Alone they are nothing; the Gloam never sends them alone.' },
  moth: { name: 'Dusk Moth', lore: 'Drawn to any light, the Ember most of all. Fast, frail, and always fluttering just out of reach.' },
  husk: { name: 'Husk', lore: 'Stone shells around a smouldering cinder heart. Slow to fall and slower to stop.' },
  wraith: { name: 'Wraith', lore: 'The last breath of those the dark swallowed, drifting back toward warmth.' },
  splitter: { name: 'Bloater', lore: 'A swollen brood-sac. Burst it and the brood spills out hungry.' },
  broodling: { name: 'Broodling', lore: 'Newborn and already starving.' },
  beetle: { name: 'Ram Beetle', lore: 'Lowers its horn, scrapes the ground, then charges in a straight line. Step aside.' },
  spitter: { name: 'Spitter', lore: 'Keeps its distance and lobs venom. Only bothers when it can see you.' },
  sentinel: { name: 'Sentinel', lore: 'A spined eye that watches the late hours of the night. Tough enough to outlast lesser builds.' },
  imp: { name: 'Cinder Imp', lore: 'Ashfields pests that burst into embers when slain. Kill them at range.' },
  frostwisp: { name: 'Frost Wisp', lore: 'Rimewood spirits whose touch steals the warmth from your legs.' },
  lurker: { name: 'Mire Lurker', lore: 'Sinks beneath the black water and rises at your heels. Strike when it surfaces.' },
  matron: { name: 'The Brood Matron', lore: 'Mother of the swarm. Every few heartbeats she births another wave.' },
  colossus: { name: 'The Cinder Colossus', lore: 'A furnace that learned to walk. Watch for the red ring before it slams.' },
  tyrant: { name: 'The Eclipse Tyrant', lore: 'The black sun that ate the day. Break its crown and dawn bleeds through.' },
};

// Daily Ember: a deterministic setup derived from the calendar date (same for everyone that day)
export function dailyKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dailyConfig(key = dailyKey()) {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const charId = pick(Object.keys(CHARACTERS));
  const stageId = pick(Object.keys(STAGES));
  const weapon = pick(Object.keys(WEAPONS).filter((w) => w !== CHARACTERS[charId].weapon));
  const pactIds = Object.keys(PACTS);
  const pacts = [pick(pactIds)];
  if (r() < 0.5) { const p2 = pick(pactIds.filter((p) => p !== pacts[0])); pacts.push(p2); }
  return { key, charId, stageId, weapon, pacts };
}
