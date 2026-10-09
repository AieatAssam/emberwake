# EMBERWAKE

[![CI](https://github.com/AieatAssam/emberwake/actions/workflows/ci.yml/badge.svg)](https://github.com/AieatAssam/emberwake/actions/workflows/ci.yml)
[![Deploy](https://github.com/AieatAssam/emberwake/actions/workflows/deploy.yml/badge.svg)](https://github.com/AieatAssam/emberwake/actions/workflows/deploy.yml)

**The sun is dead. You carry the last Ember.** Burn brighter than the Gloam — or be swallowed by it.

A browser bullet-heaven survival roguelite built with **PixiJS v8** (WebGL, batched `ParticleContainer`s), with every sprite, sound and music track generated procedurally in code.

▶ **Play:** https://aieatassam.github.io/emberwake/

## What makes it Emberwake
- **Kindle** — kills feed a streak multiplier (up to x2.5 cinders, half-strength XP bonus). Stop killing and it gutters out.
- **Flare** — each Bearer has an ultimate charged by kills (SPACE / gamepad A / touch button).
- **Ascension** — two max-level partner weapons fuse at a chest into one Ascended weapon, *freeing a slot*.
- **Dark Pacts** — rare draft cards that trade danger for permanent power.
- **Totems** — breakable obelisks hiding magnets, bombs, frost, healing and flare charge.
- **Overcharge** — once everything is maxed, every level-up auto-applies stacking power. Forever.
- **Gloam Pressure** — erase the horde faster than it arrives and the dark pushes harder, so a god-tier build always has a tide to carve through.
- **The Hearth** — spend cinders on permanent upgrades and new Bearers.
- **Stages** — The Gloam, The Ashfields, The Rimewood and The Drowned Marsh: distinct ground, enemy mixes and risk/reward multipliers, unlocked with cinders.
- **Heat** — win a stage to unlock the next of 5 Heat levels: tougher, faster, denser runs for up to +150% cinders.
- **Feats** — 15 achievements that pay cinders, with live unlock banners.
- **Kindle gifts** — first reaching Kindle tiers 3, 4 and 6 in a run drops a Flare charge, a Magnet and a Chest.
- **Ember Thieves** flee with a chest — catch them. **Blood Moons** make foes faster and XP double.
- **Pact of the Wick** — a new Dark Pact: harder-hitting foes in exchange for a revival.
- Reactive music (menu theme, A-A-B-C song form with echoing counter-melody, boss and Hollow layers, pause muffle) and a much wider sound palette.
- **Soft obstacles** — pillars, tombs, crystals and trees resist you (you slide along them, or wade through at 35% speed) but never wall you in; mud and dunes drag at your heels; Ashfield vents erupt after a warning. Enemies pass through, as in Vampire Survivors.
- **Chests you can read** — bronze, silver, gold or violet (Ascension ready) depending on contents, with a light beam and off-screen arrows; opening one builds anticipation with a quickening heartbeat before the reveal.
- **Perks** — every Bearer has a signature perk beyond stats (longer Kindle, dodge, bell toll, Marked Prey, Hearthheart...), and two new Bearers: Sable the Gloam Hunter and Orin the Hearthkeeper.
- **New stages** — The Shattered Reliquary and The Glass Dunes, each with its own enemies, scenery and music.
- **Random events** — healing springs, meteor showers with telegraphed impacts, Blood Moons and Ember Thieves.
- Recorded CC0 music per stage, menu and boss fights (see `public/music/CREDITS.txt`), with the procedural score as a fallback.
- 8 Bearers, 15 weapons, 8 Ascensions, 15 relics, 12+ enemy types, 3 bosses, 6 stages, endless mode.

## Controls
WASD / arrows · SPACE flare · ESC pause · 1–4 pick upgrade · R reroll · B banish. Gamepad and touch supported.

## Dev
In `npm run dev`, the console exposes a headless balance simulator:
`await __sim(900, 'warden')` runs the real game loop with a kiting bot and reports
level curve, kills, per-system frame cost, slow-frame breakdowns and what killed you.

```bash
npm install
npm run dev     # local dev server
npm run build   # static build in dist/ (relative paths, GitHub Pages ready)
npm run lint    # ESLint + Stylelint + html-validate, all with --max-warnings 0
```

## Quality gates
- **CI** (`.github/workflows/ci.yml`) runs on every push and PR: ESLint, Stylelint and html-validate
  with warnings treated as errors, a production build, and a check that dev-only hooks never ship.
- **Deploy** (`.github/workflows/deploy.yml`) lints before building and publishing to GitHub Pages.
- **Dependabot** (`.github/dependabot.yml`) opens weekly grouped updates for npm and GitHub Actions.
Deploys automatically to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.
