# EMBERWAKE

[![CI](https://github.com/AieatAssam/emberwake/actions/workflows/ci.yml/badge.svg)](https://github.com/AieatAssam/emberwake/actions/workflows/ci.yml)
[![Deploy](https://github.com/AieatAssam/emberwake/actions/workflows/deploy.yml/badge.svg)](https://github.com/AieatAssam/emberwake/actions/workflows/deploy.yml)

**The sun is dead. You carry the last Ember.** Burn brighter than the Gloam — or be swallowed by it.

Emberwake is a browser **bullet-heaven survival roguelite** in the vein of *Vampire Survivors*, built with **PixiJS v8** (WebGL, batched `ParticleContainer`s). You steer; your weapons fire on their own. Survive fifteen minutes of ever-denser hordes, draft a build from a pile of weapons, relics and Dark Pacts, fuse your best weapons into Ascended forms, and break the Eclipse Tyrant at the end of the night. Every sprite and sound effect is generated procedurally in code; the music is a mix of recorded CC0 tracks and a procedural score.

▶ **Play:** https://aieatassam.github.io/emberwake/ (desktop, tablet and phone)

![Title screen](docs/img/title.png)

## Contents
- [How a run works](#how-a-run-works) · [What makes it Emberwake](#what-makes-it-emberwake)
- [Bearers](#bearers) · [Weapons, Ascensions and relics](#weapons-ascensions-and-relics) · [Dark Pacts](#dark-pacts)
- [Stages](#stages) · [Enemies and bosses](#enemies-and-bosses) · [Random events and scenery](#random-events-and-scenery)
- [Progression](#progression) · [Difficulty](#difficulty) · [Controls](#controls) · [Mobile](#mobile)
- [Audio](#audio) · [Development](#development) · [Balance bots](#balance-bots) · [Quality gates](#quality-gates)

## How a run works
1. **Pick a Bearer and a stage**, and optionally a Heat level and a difficulty.
2. **Move; everything else is automatic.** Your starting weapon fires on its own. Defeated foes drop gems; collect them to level up.
3. **Draft.** Each level-up offers a choice of weapon upgrades, passive relics, and now and then a risky Dark Pact. You hold up to six weapons and six relics, and you can reroll, banish or skip cards.
4. **Open chests.** Elites, bosses, shrines and thieves drop chests. They are bronze, silver or gold by contents, violet when an Ascension is ready, each with a light beam you can see from across the screen. Opening one builds anticipation with a quickening heartbeat before the reveal.
5. **Ascend.** Bring two partner weapons to max level, open a chest, and they fuse into one Ascended weapon, *freeing a slot*.
6. **Survive the boss timeline.** The Brood Matron at 5:00, the Cinder Colossus at 10:00, the Gloam Herald at 12:30 and the **Eclipse Tyrant at 15:00**. Kill the Tyrant to win, then bank the victory or keep burning in Endless mode... until the **Hollow** comes for you.
7. **Bank your cinders** at the Hearth for permanent upgrades, new Bearers and new stages, then go again.

| Level-up draft | Opening a chest |
|---|---|
| ![Level-up](docs/img/levelup.png) | ![Chest reveal](docs/img/chest_open.png) |

## What makes it Emberwake
- **Kindle** — kills feed a streak multiplier (up to x2.5 cinders, half-strength XP bonus). Stop killing and it gutters out. First reaching tiers 3, 4 and 6 in a run also drops a Flare charge, a Magnet and a Chest.
- **Flare** — each Bearer has a unique ultimate charged by kills (SPACE / gamepad A / touch button).
- **Ascension** — two max-level partner weapons fuse at a chest into one Ascended weapon, *freeing a slot*.
- **Dark Pacts** — rare draft cards that trade danger for permanent power.
- **Totems** — breakable obelisks hiding magnets, bombs, frost, healing and flare charge.
- **Overcharge** — once everything is maxed, every level-up auto-applies stacking power. Forever.
- **Gloam Pressure** — erase the horde faster than it arrives and the dark pushes harder, so a god-tier build always has a tide to carve through.
- **Soft obstacles** — pillars, tombs, crystals and trees resist you (you slide along them, or wade through at a fraction of your speed) but never wall you in; mud and dunes drag at your heels; Ashfield vents erupt after a warning. Enemies pass through scenery, as in Vampire Survivors.
- **Signature perks** — every Bearer has a passive perk beyond their stats (longer Kindle, dodge, bell toll, Marked Prey, Hearthheart...).
- **Random events** — healing springs, meteor showers with telegraphed impacts, Blood Moons, Ember Thieves running off with a chest, stampedes and rings of enemies closing in.
- **Readable battlefield** — scenery is dimmed and low-contrast; drops glow; elites and bosses carry coloured halos; chests beam.
- **The Hearth** — spend cinders on permanent upgrades, new Bearers, new stages, and the endless **Eternal Embers**.
- **Heat** — win a stage to unlock the next Heat level (up to 10): tougher, faster, denser runs that pay more cinders.
- **Difficulty setting** — Easy / Normal / Hard / Brutal: harder runs pay more cinders and XP, easier runs pay less.
- **Feats** — 16 achievements that pay cinders, with live unlock banners.
- **Daily Ember** — a fixed, shared setup that changes every day.
- 8 Bearers, 15 weapons, 8 Ascensions, 17 relics, 6 Dark Pacts, 12+ enemy types, 4 bosses plus the Hollow, 6 stages, Endless mode.

## Bearers
Each Bearer starts with a different weapon, bonus, Flare and perk. Later Bearers unlock at the Hearth for cinders **and** an accomplishment.

| Bearer | Weapon | Bonus | Flare | Perk |
|---|---|---|---|---|
| **Kael**, the Ashen Warden | Ember Bolt | +10% damage | **Supernova** — a colossal ring of fire | **Slow Burn** — Kindle lasts 35% longer |
| **Ysolde**, the Rime Oracle | Rime Pulse | +15% area, +10% duration, +10% damage | **Absolute Zero** — freeze every enemy; frozen foes shatter for double damage | **Rime Heart** — foes that die frozen charge your Flare 2.5x faster |
| **Pip**, the Clockwork Tinker | Spark Drones | -10% cooldowns, +15% projectile speed | **Overclock** — all weapons fire 3x faster | **Salvage** — every 40s a gadget drops (magnet, bomb, stillwater, flare orb) |
| **Grahm**, the Blood Reaver | Crescent Arc | +40 health, +1 armor, +0.5 regen | **Bloodrage** — double damage, +30% speed, lifesteal | **Bloodthirst** — every kill heals a little |
| **Lune**, the Moon Dancer | Moonglaive | +20% move speed, +20% luck | **Moonfall** — twelve glaives spiral out, then you blink untouchable | **Moonstep** — 14% chance to slip any hit; longer invulnerability after being struck |
| **Brannoc**, the Bellwright | Gravewell | +25% max health, +15% area, -10% move speed | **Great Toll** — every foe on screen stunned and struck by three rings of sound | **Tollbearer** — every 15s the bell tolls, hurling nearby foes away |
| **Sable**, the Gloam Hunter | Rime Lance | +15% crit chance, +35% crit damage, +10% damage | **Deadeye** — every strike crits and projectiles fly faster | **Marked Prey** — +25% damage to elites and bosses |
| **Orin**, the Hearthkeeper | Sunring | +30% health, +1.2 regen, +20% area, -5% move speed | **Hearthfire** — plant a roaring hearth that burns foes and mends you | **Hearthheart** — every level-up restores 20% health |

![Character select](docs/img/select.png)

## Weapons, Ascensions and relics

**15 weapons**, each with 8 levels: Ember Bolt (seeking fireballs), Halo Sickles (orbiting blades), Storm Coil (chain lightning), Rime Pulse (freezing shockwave), Wisp Swarm (hunting wisps), Crescent Arc (sweeping cleave), Starfall (meteors), Moonglaive (returning glaive), Prism Beam (rotating beams), Bloom Mines (volatile blossoms), Spark Drones (hovering sparkers), Sunring (flame aura), Rime Lance (piercing icicles), Gravewell (vortex that implodes), Sanctum Quills (radial quills).

**8 Ascensions** — max out both parents, open a chest, and they become one stronger weapon:

| Ascension | Recipe | Effect |
|---|---|---|
| Cataclysm Comet | Ember Bolt + Starfall | Fireballs detonate on impact and the sky never stops falling |
| Thousand Edges | Halo Sickles + Crescent Arc | An eternal storm of blades and a cleave that hits all around |
| Tempest Heart | Storm Coil + Rime Pulse | Every frozen pulse crackles with chain lightning |
| Seraph Choir | Wisp Swarm + Prism Beam | Endless prismatic beams and wisps that burst into light |
| Eclipse Disc | Moonglaive + Sunring | Black-sun glaives orbit inside a blazing corona |
| Hive Foundry | Bloom Mines + Spark Drones | A drone wing that seeds the ground with blossoms |
| Glacier Spire | Rime Lance + Sanctum Quills | Radiant ice erupts in every direction, freezing solid |
| Event Horizon | Gravewell + Starfall | Vortices drag the horde into a knot while the sky falls on it |

**17 relics** (up to 5 levels each): Ember Heart (damage), Quicksilver (cooldowns), Wide Lens (area), Gale Feather (projectile speed), Echo Shard (+1 projectile; weapons without projectiles gain damage and area instead), Iron Root (health), Living Moss (regen), Wind Boots (move speed), Lodestone (pickup radius), Lucky Bone (luck), Hawk Eye (crit), Hourglass (duration), Bark Plate (armor), Sage Tome (XP), Gilded Tooth (cinders), Ember Reservoir (Flare charge), Thorn Mail (reflects melee hits).

## Dark Pacts
Rare, risky draft cards (up to three per run): **Hunger** (more spawns, more damage and XP), **Glass** (less health, much more damage), **Frenzy** (faster enemies, faster you), **Avarice** (tougher enemies, double cinders), **the Wick** (enemies hit harder, +1 revival) and **Ashes** (no healing pickups, +1 projectile).

## Stages
Each stage has its own ground, scenery, music, enemy mix and cinder multiplier. Harder stages pay more.

| Stage | Flavour |
|---|---|
| **The Gloam** | Moss-choked ruins at the edge of the dark. Where every Bearer begins. |
| **The Ashfields** | Scorched plains where husks and ram beetles stampede; basalt, stumps and erupting vents. |
| **The Rimewood** | A frozen forest where wraiths and frost wisps drift between the trees. |
| **The Drowned Marsh** | A black bog where lurkers sink and surface at your heels; mud and reeds slow you. |
| **The Shattered Reliquary** | A drowned cathedral of tombs and guttering candles; Candle Acolytes keep their vigil. |
| **The Glass Dunes** | Sun-fused wastes where Glass Scarabs scatter like sparks; sand drifts drag at your heels. |

| | | |
|---|---|---|
| ![Gloam](docs/img/stage_gloam.jpg) | ![Ashfields](docs/img/stage_ashfields.jpg) | ![Rimewood](docs/img/stage_rimewood.jpg) |
| ![Marsh](docs/img/stage_marsh.jpg) | ![Reliquary](docs/img/stage_reliquary.jpg) | ![Glass Dunes](docs/img/stage_glassdunes.jpg) |

## Enemies and bosses
Gloomlings, Dusk Moths, Husks, Wraiths, Bloaters (which burst into Broodlings), Ram Beetles (telegraphed charges), Spitters (ranged), Sentinels, plus stage specials: Cinder Imps, Frost Wisps, Mire Lurkers, Glass Scarabs and Candle Acolytes. From three minutes, elites roll **affixes**: swift, vampiric, warded or volatile.

| Boss | When | What to watch |
|---|---|---|
| The Brood Matron | 5:00 | Births a new wave every few heartbeats |
| The Cinder Colossus | 10:00 | Watch for the red ring before it slams |
| The Gloam Herald | 12:30 | Blinks and shrouds itself; strike in the moments after it erupts |
| The Eclipse Tyrant | 15:00 | Fires expanding novas. Break it and dawn bleeds through |
| The Hollow | after the Tyrant, or 18:00 | Cannot be harmed and never tires. Run |

## Random events and scenery
Rings of foes close in, stampedes rush through, **Ember Thieves** sprint away with a chest, **Blood Moons** speed everything up while doubling XP, **healing springs** bubble up, and **meteor showers** rain down on telegraphed circles that hurt you and the horde alike. Ember Shrines ask you to hold your ground for a relic chest. Scenery such as pillars, tombs, crystals and trees slows you without ever trapping you; stage hazards such as erupting vents warn before they hurt.

## Progression
- **Cinders** are the currency. You gather them in runs (plus a survival bonus and one-off **milestone bonuses** the first time you outlast 3, 6, 10 and 15 minutes on each stage) and spend them at **the Hearth**.
- **Hearth upgrades** give permanent stat bonuses (damage, health, armor, regen, cooldowns, area, speed, pickup radius, XP, cinders, luck, Flare charge, rerolls, banishes, a second projectile, revivals, a starting relic).
- **Unlocks** — later Bearers and stages cost cinders **and** an accomplishment (surviving a number of minutes, reaching a level, slaying a boss, winning a run...), so grinding alone never skips the game.
- **Eternal Embers** — after your first win, an endless, ever-pricier sink for spare cinders with small, capped bonuses, so there is always something to work toward.
- **Heat** — each win on a stage unlocks the next of 10 Heat levels there: tougher enemies, denser hordes, more elites, weaker Overcharge, and more cinders.
- **Feats** — 16 one-time achievements that pay cinders.
- **Dawn skins** — win with a Bearer to unlock their Dawn variant.
- **Codex** — Ascensions, feats, records and a bestiary that fills as you meet things.

![The Hearth](docs/img/hearth.png)

## Difficulty
Pick a difficulty in **Settings** or from the Bearer-select screen (it applies to your next run). Harder runs pay more; easier runs pay less. The Daily Ember is always played on Normal.

| Difficulty | Enemy health | Enemy damage | Horde size | Cinders | XP |
|---|---|---|---|---|---|
| Easy | x0.8 | x0.7 | x0.85 | x0.6 | x0.8 |
| Normal | x1 | x1 | x1 | x1 | x1 |
| Hard | x1.4 | x1.4 | x1.2 | x1.6 | x1.1 |
| Brutal | x1.7 | x1.6 | x1.35 | x2.2 | x1.2 |

![Settings](docs/img/settings.png)

## Controls
| | Move | Flare | Pause | Draft |
|---|---|---|---|---|
| **Keyboard** | WASD / arrows | SPACE | ESC or P | 1–4 pick · R reroll · B banish · X skip |
| **Touch** | Drag anywhere (floating stick) | ✹ button | II button | Tap |
| **Gamepad** | Left stick / D-pad | A or RB | Start | D-pad + A |

## Mobile
Emberwake is built to be played on a phone: a floating joystick that follows your thumb, large Flare and Pause buttons, safe-area handling for notches, keyboard hints replaced with touch hints, optional vibration, a screen wake lock during runs, a fullscreen button, short-landscape layouts and a lower render scale on high-density screens.

<img src="docs/img/mobile.jpg" alt="Mobile gameplay" width="320">

Comfort options in Settings: master and music volume, mute, damage numbers, screen shake, a reduced-effects mode (fewer particles, no flashes) and vibration. Reduced-motion system settings are respected.

## Audio
- **Music** — recorded **CC0** tracks give each stage, the menu and the boss fights their own tone (see [`public/music/CREDITS.txt`](public/music/CREDITS.txt) for authors and links). If a track cannot load, a generative score takes over: per-stage themes, an A-A-B-C song form with an echoing counter-melody, and boss and Hollow layers.
- **Sound effects** — all synthesised live with the Web Audio API: hits, crits, a distinct Flare for each Bearer, chest build-up and burst, shrine, ascension, revive, Hollow and more.

## Development
```bash
npm install
npm run dev     # local dev server
npm run build   # static build in dist/ (relative paths, GitHub Pages ready)
npm run lint    # ESLint + Stylelint + html-validate, all with --max-warnings 0
```
Layout: `src/game.js` (simulation and rendering), `src/weapons.js` (weapon behaviours), `src/data.js` (all content data), `src/tuning.js` (global balance knobs), `src/atlas.js` (procedural sprites), `src/audio.js` (SFX, music), `src/ui.js` and `src/style.css` (menus and HUD), `src/input.js` (keyboard, gamepad, touch), `src/devsim.js` (dev-only bots).

In `npm run dev` the console exposes a headless simulator: `await __sim(900, 'warden', { skill: 'average' })` runs the real game loop with a bot and reports level curve, kills, cinders earned and what killed you.

## Balance bots
`npm run balance` drives bots of four graded skill levels (**novice, average, skilled, expert**) through full runs in parallel headless browsers and prints win rate, survival time, level and cinder income per cell, so difficulty and the economy can be tuned against numbers instead of feel.
```bash
npm run dev &          # the harness talks to the dev server
npm run balance -- --url http://localhost:5173 --runs 8 --skills novice,average,skilled,expert \
  --chars warden --stages gloam --difficulty normal --meta 0 --heat 0 --secs 1000 --workers 4
# override balance knobs per run, no code edits needed:
npm run balance -- --runs 8 --tune xp=0.5,enemyDmg=1.3,spawn=1.1
```
Bots steer only through the same input path as a player and use a direction-sampling dodger whose awareness, reaction time, lookahead, drafting and Flare timing scale with skill. Knobs live in [`src/tuning.js`](src/tuning.js). Sims run without particles and at a 0.1 s step (validated against 0.05 s; do not go to 0.2) so a full 15-minute run takes about a minute. See the script header for all options.

## Quality gates
- **CI** (`.github/workflows/ci.yml`) runs on every push and PR: ESLint, Stylelint and html-validate with warnings treated as errors, a production build, and a check that dev-only hooks never ship.
- **Deploy** (`.github/workflows/deploy.yml`) lints before building and publishing to GitHub Pages on push to `main`.
- **Dependabot** (`.github/dependabot.yml`) opens weekly grouped updates for npm and GitHub Actions.

## Credits
Code, sprites and sound effects: this repository. Music: public-domain (CC0) tracks by yd, Sorth, cynicmusic, beardalaxy, congusbongus, Spring Spring and Pro Sensory via [OpenGameArt.org](https://opengameart.org). Fonts: Cinzel and Chakra Petch (Google Fonts, OFL).
