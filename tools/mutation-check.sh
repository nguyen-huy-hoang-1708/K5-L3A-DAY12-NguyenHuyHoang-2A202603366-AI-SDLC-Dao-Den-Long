#!/usr/bin/env bash
# Sanity check that the test suite is not "always green": apply deliberate bugs to src/sim.js one at a time
# and count failing tests. Every mutation must be caught (>0 failing). Restores src/sim.js afterwards.
set -u
cd "$(dirname "$0")/.."
B=$(mktemp); BM=$(mktemp); cp src/sim.js "$B"; cp src/maps.js "$BM"
trap 'cp "$B" src/sim.js; cp "$BM" src/maps.js; rm -f "$B" "$BM"' EXIT
ok=1
mut(){ # $1 = sed expression, $2 = label, $3 = file (default src/sim.js)
  local f=${3:-src/sim.js}
  cp "$B" src/sim.js; cp "$BM" src/maps.js
  sed -i.bak "$1" "$f" && rm -f "$f.bak"
  if cmp -s "$B" src/sim.js && cmp -s "$BM" src/maps.js; then echo "NOT APPLIED  $2"; ok=0; return; fi
  n=$(node --test --test-reporter=tap tests/*.test.js 2>&1 | grep -c "^not ok")
  if [ "$n" -gt 0 ]; then echo "caught ($n failing)  $2"; else echo "SURVIVED     $2"; ok=0; fi
}
mut 's/if (d < TUNING.safe_radius) {/if (false \&\& d < TUNING.safe_radius) {/' "M1 safe zone disabled"
mut 's/const amount = Math.min(P.carried, Math.max(0, cost - best.deposited));/const amount = P.carried;/' "M2 deposit not capped"
mut 's/    if (P.invulnT <= 0) {/    if (true) {/' "M3 no invulnerability"
mut 's/P.pulseCdT === 0 \&\& P.carried >= TUNING.pulse_cost/true/' "M4 pulse free + no cooldown"
mut 's/g.score += amount \* TUNING.score.per_mote;/g.score += 0;/' "M5 no deposit score"
mut 's/const wx = mx \* Math.cos(th) + mz \* Math.sin(th);/const wx = mx * Math.cos(th) - mz * Math.sin(th);/' "M6 wrong yaw sign"
mut 's/PULSE_CD_T: 180, PULSE_CENTER_Y: 0.8, STUN_T: 120/PULSE_CD_T: 180, PULSE_CENTER_Y: 0.8, STUN_T: 60/' "M7 stun 1 s instead of 2 s"
mut 's/const dropped = Math.floor(P.carried \/ 2);/const dropped = Math.ceil(P.carried \/ 2);/' "M8 drop rounds up"
mut 's/  else if (timeLeft(g) <= 1e-9) {/  else if (timeLeft(g) < -1) {/' "M9 dawn never ends the night"
mut 's/if (g.lanterns.filter((l) => l.lit).length >= need)/if (g.lanterns.filter((l) => l.lit).length >= 0)/' "M27 dawn win ignores the 60% rule"
mut 's/DECAY_U: 1,/DECAY_U: 2,/' "M28 fuel decays twice as fast"
mut 's/DRAIN_U: 5,/DRAIN_U: 4,/' "M29 drain too weak"
mut 's/LOW_U: 1800,/LOW_U: 1500,/' "M30 low-fuel threshold wrong"
mut 's/const cost = best.everLit ? TUNING.relight_cost : TUNING.lantern_cost;/const cost = TUNING.lantern_cost;/' "M31 relight costs 10"
mut 's/CAP_STEP: 2,/CAP_STEP: 0,/' "M32 capacity never grows"
mut 's/Math.ceil((K.FUEL_MAX_U - best.fuelU) \/ K.FUEL_PER_MOTE_U)/Math.floor((K.FUEL_MAX_U - best.fuelU) \/ K.FUEL_PER_MOTE_U)/' "M33 refuel rounds down"
mut 's/g.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;/g.score += TUNING.score.per_lantern;/' "M34 relight scores like first light"
mut 's/if (!P.dead \&\& distXZ(s.pos, P.pos) <= K.DRAIN_CHASE) s.state = .chase.;/if (false) s.state = "chase";/' "M35 drain never turns to chase"
mut 's/g.score += s.state === .drain. ? TUNING.score.per_stun_draining : TUNING.score.per_stun;/g.score += TUNING.score.per_stun;/' "M36 no drain pulse bonus"
mut 's/if (!l.lit || l.fuelU < K.LOW_U) continue;/if (!l.lit) continue;/' "M37 weak lantern keeps its safe zone"
mut 's/        if (before < K.LOW_U \&\& best.fuelU >= K.LOW_U) newlyLit.push(best);/        \/\/ no evict/' "M38 refuel does not evict"
mut 's/for (const l of g.lanterns) if (l.lit) g.score += s.per_lit_lantern_at_dawn + Math.floor(l.fuelU \/ 60);/\/\/ no lantern bonus/' "M39 no dawn lantern bonus"
mut 's/player_speed: 6,/player_speed: 6.5,/' "M10 speed drifts from contract"
mut 's/if (P.charmT <= 0) P.dashCdT = K.DASH_CD_T;/P.dashCdT = 0;/' "M11 dash has no cooldown"
mut 's/DASH_T: 12,/DASH_T: 10,/' "M12 dash too short"
mut 's/const amount = Math.min(K.DRIFT_STEAL, P.carried);/const amount = P.carried;/' "M13 drifter steals everything"
mut 's/DRIFT_CHASE_N: 5,/DRIFT_CHASE_N: 7,/' "M14 drifter chase threshold wrong"
mut 's/CHARM_SPEED: 7.2,/CHARM_SPEED: 6,/' "M15 charm has no speed boost"
mut 's/^  if (g.paused) return g.events;/  if (false) return g.events;/' "M16 pause does not freeze sim"
mut 's/if (P.pos\[1\] < K.FALL_Y) {/if (P.pos[1] < -1000) {/' "M17 never fall off"
mut 's/RESPAWN_T: 60,/RESPAWN_T: 1,/' "M18 no respawn wait"
mut 's/(t - K.SHADE_FIRST) % map.shadeEvery === 0/(t - K.SHADE_FIRST) % 600 === 0/' "M19 wrong shade schedule"
mut 's/const count = t === K.SHADE_FIRST ? 2 : 1;/const count = 1;/' "M20 only one shade at tick 300"
mut 's/s.evictT = K.EVICT_T;/s.evictT = 0;/' "M21 no eviction from new safe zone"
mut 's/WIND_SPEED: 2,/WIND_SPEED: 3,/' "M22 wind too strong"
mut 's/shadeSpeed: 4.5,/shadeSpeed: 4.0,/' "M23 night 3 shades too slow" src/maps.js
mut 's/vy: 12, h: 8, dir/vy: 10, h: 8, dir/' "M25 night 3 pad too weak" src/maps.js
mut 's/shadeEvery: 420,/shadeEvery: 480,/' "M26 night 2 shade interval wrong" src/maps.js
mut 's/STEP: 0.35,/STEP: 5,/' "M24 tier walls climbable"
[ $ok = 1 ] && echo "ALL MUTATIONS CAUGHT" || { echo "SOME MUTATIONS SURVIVED"; exit 1; }
