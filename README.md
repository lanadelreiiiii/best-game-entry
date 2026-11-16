# KITEWARDEN — hold the ridge against the storm

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/lanadelreiiiii/best-game-entry/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/lanadelreiiiii/best-game-entry/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A wind-and-kite tower defense for make.fun's "Make the best game" bounty ($1,000 in USDC).

**The game in one sentence:** build kite towers on ridge nodes, and the wind — which shifts
every wave — bends every shot, so a tower standing downwind reaches farther; hold 20 waves
against wisps, drifters and the Storm Serpent, then keep going in endless mode.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files. Click a ridge node to build,
click a tower to upgrade or sell. `Space` start wave / pause, `1–6` pick a tower, `F` speed ×2,
`R` restart, `M` mute.

## What's inside

- 6 towers: Kite Archer, Gale Fan, Storm Rod, Snare Kite, Ember Kite (burn), Beacon
- 6 enemies: Wisp, Drifter, Gustling, Shearling, Storm Mender (heals the pack), Storm Serpent (boss every 5th wave)
- 20 waves + endless, 1-of-3 gust blessings every 5 waves, 4 upgrade levels per tower
- Wind model: direction + strength per wave, curving projectiles, downwind range bonus
- Procedural WebAudio (wind, shots, kills, lightning), particles, damage numbers, screen shake

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's vendored `buildDossier`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8tzhpmv9&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
