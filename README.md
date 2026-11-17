# KITEWARDEN — hold the ridge against the storm

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/lanadelreiiiii/best-game-entry/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/lanadelreiiiii/best-game-entry/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A wind-and-kite tower defense for make.fun's "Make the best game" bounty ($1,000 in USDC).

**The game in one sentence:** build kite towers on ridge nodes, and the wind — which shifts
every wave — bends every shot, so a tower standing downwind reaches farther; **click a
Wind Vane to turn the wind** and bend shots around corners inside its ring; from wave 3
**the path forks** into a Ridge lane and a Valley lane and every wave splits across both,
while the Scout Kite slips down whichever lane has fewer towers watching it; hold 20 waves
against wisps, drifters and the Storm Serpent, then keep going in endless mode.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files. Click a ridge node to build,
click a tower to upgrade or sell, click a wind vane to turn the local wind (free, anytime,
even mid-wave). `Space` start wave / pause, `1–6` pick a tower, `F` speed ×2,
`R` restart, `M` mute.

## What's inside

- 6 towers: Kite Archer, Gale Fan, Storm Rod, Snare Kite, Ember Kite (burn), Beacon
- 7 enemies: Wisp, Drifter, Gustling, Shearling, Storm Mender (heals the pack), Scout Kite (fast, takes the emptier lane at the fork), Storm Serpent (boss every 5th wave)
- 20 waves + endless, 1-of-3 gust blessings every 5 waves, 4 upgrade levels per tower
- Wind model: direction + strength per wave, curving projectiles, downwind range bonus
- **Wind Vanes (the mechanic):** 3 turnable vanes on open ground, one per band of the map.
  Each vane points at one of 8 compass headings; a click turns it 45°, free. Inside its
  170px ring the local wind blends 65% toward the vane's direction (fading to the ring's
  edge), so shots flying through the ring bend toward where you pointed it and a tower's
  downwind range bonus is judged on the local wind. Vanes re-align to each new wave's
  wind at wave start. Big kite-vane arrow, dashed influence ring, compass label, pulse
  ring on every turn.
- **Forked Paths (the second lane):** from wave 3 the serpentine path forks at the
  mid-map signpost into two lanes that converge again at the base — the **Ridge** lane
  (the old high road west along y=360) and the **Valley** lane (south, then west along
  the mossy-green valley floor at y=540). Both lanes are exactly the same length, so
  neither is a shortcut and distance-travelled means the same thing on either one.
  Each wave's split is seeded (35–65% Ridge) and named in the wave banner, e.g.
  "Wave 6 splits Ridge 60% / Valley 40%". The fork signpost, the lane labels and the
  Valley lane's green tint make the split visible in every screenshot.
- **Scout Kite:** the fastest, most fragile creature on the ridge (88 px/s, 20 HP, from
  wave 5). At the fork it counts the attacking towers in range of each lane and takes
  the less-defended one — seeded tiebreak — so a ridge stacked on one lane gets
  flanked down the other. Slim orange diamond with a gold pennant: nothing else on
  the ridge looks like it.
- Procedural WebAudio (wind, shots, kills, lightning, vane chime), particles, damage numbers, screen shake

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's vendored `buildDossier`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=8tzhpmv9&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
