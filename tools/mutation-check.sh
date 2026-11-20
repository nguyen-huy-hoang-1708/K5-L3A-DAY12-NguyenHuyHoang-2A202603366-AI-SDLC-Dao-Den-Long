#!/usr/bin/env bash
# Sanity check that the test suite is not "always green": apply deliberate bugs to src/sim.js one at a time
# and count failing tests. Every mutation must be caught (>0 failing). Restores src/sim.js afterwards.
set -u
cd "$(dirname "$0")/.."
B=$(mktemp); cp src/sim.js "$B"; trap 'cp "$B" src/sim.js; rm -f "$B"' EXIT
ok=1
mut(){
  cp "$B" src/sim.js
  sed -i.bak "$1" src/sim.js && rm -f src/sim.js.bak
  if cmp -s "$B" src/sim.js; then echo "NOT APPLIED  $2"; ok=0; return; fi
  n=$(node --test --test-reporter=tap tests/*.test.js 2>&1 | grep -c "^not ok")
  if [ "$n" -gt 0 ]; then echo "caught ($n failing)  $2"; else echo "SURVIVED     $2"; ok=0; fi
}
mut 's/if (e < TUNING.safe_radius) {/if (false \&\& e < TUNING.safe_radius) {/' "M1 safe zone disabled"
mut 's/const amount = Math.min(P.carried, Math.max(0, TUNING.lantern_cost - best.deposited));/const amount = P.carried;/' "M2 deposit not capped"
mut 's/P.invulnT = secToTicks(TUNING.invuln_s);/P.invulnT = 0;/' "M3 no invulnerability"
mut 's/if (pulseE \&\& P.pulseCdT <= 0 \&\& P.carried >= TUNING.pulse_cost) {/if (pulseE) {/' "M4 pulse free + no cooldown"
mut 's/g.score += sc.per_mote;/g.score += 0;/' "M5 no mote score"
mut 's/const wx = mx \* Math.cos(th) + mz \* Math.sin(th);/const wx = mx * Math.cos(th) - mz * Math.sin(th);/' "M6 wrong yaw sign"
mut 's/s.stunT = secToTicks(TUNING.pulse_stun_s);/s.stunT = 60;/' "M7 stun 1s instead of 3s"
mut 's/Math.floor(P.carried \* TUNING.hit_drop_ratio + 1e-9)/Math.ceil(P.carried * TUNING.hit_drop_ratio)/' "M8 drop rounds up"
mut 's/if (timeLeft(g) <= 1e-9) endGame/if (timeLeft(g) < -1) endGame/' "M9 dawn never ends the night"
mut 's/player_speed: 6,/player_speed: 6.5,/' "M10 speed drifts from contract"
[ $ok = 1 ] && echo "ALL MUTATIONS CAUGHT" || { echo "SOME MUTATIONS SURVIVED"; exit 1; }
