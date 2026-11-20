#!/usr/bin/env bash
# Proof that creative additions (client-only, in web/) cannot change contract headless output.
#  1) Static: the headless path (headless/, src/) never imports anything from web/.
#  2) Dynamic: copy ONLY the headless path (no web/ at all) to a temp dir and check its output is byte-identical to the
#     repo's, for every fixture in tests/scenarios (with its night) and a full default night on each of the 3 maps.
# (Phase 1 compared against tag ui-classic; since Ticket-02 changed the rules themselves, the base is now "no web/".)
set -u
cd "$(dirname "$0")/.."
echo "== creative-check at $(git rev-parse --short HEAD)$(git diff --quiet -- src headless || echo ' +uncommitted') — repo vs. headless path without web/"
fail=0
if grep -rnE "from ['\"][./]*web/|require\(['\"][./]*web/|import\(['\"][./]*web/" src headless; then echo "FAIL: headless path imports web/"; fail=1; else echo "ok   headless/ and src/ do not import web/"; fi
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/core"
cp -R src headless package.json "$TMP/core/"
[ -d "$TMP/core/web" ] && { echo "FAIL: web/ leaked into copy"; fail=1; }
run() { local root=$1 out=$2; shift 2; node "$root/headless/run.js" --out "$out" "$@"; }
for d in tests/scenarios/*/; do
  name=$(basename "$d"); night=1
  [ -f "$d/meta.json" ] && night=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$d/meta.json','utf8')).night||1)")
  args=(--seed 5 --night "$night" --ticks 1800)
  [ -f "$d/scenario.json" ] && args+=(--scenario "$PWD/$d/scenario.json")
  [ -f "$d/inputs.json" ] && args+=(--inputs "$PWD/$d/inputs.json")
  run "$TMP/core" "$TMP/a.jsonl" "${args[@]}"; run "$PWD" "$TMP/b.jsonl" "${args[@]}"
  if cmp -s "$TMP/a.jsonl" "$TMP/b.jsonl"; then echo "ok   fixture $name (night $night) identical ($(wc -l < "$TMP/a.jsonl" | tr -d ' ') lines)"; else echo "FAIL fixture $name differs"; fail=1; fi
done
for night in 1 2 3; do
  run "$TMP/core" "$TMP/a.jsonl" --seed 2026 --night $night --ticks 21600 --scenario "$PWD/tests/scenarios/default_spawn/scenario.json"
  run "$PWD" "$TMP/b.jsonl" --seed 2026 --night $night --ticks 21600 --scenario "$PWD/tests/scenarios/default_spawn/scenario.json"
  h=$(shasum -a 256 "$TMP/b.jsonl" | cut -c1-16)
  if cmp -s "$TMP/a.jsonl" "$TMP/b.jsonl"; then echo "ok   full night $night identical (sha256 $h…)"; else echo "FAIL full night $night differs"; fail=1; fi
done
[ $fail = 0 ] && echo "PASS: creative additions in web/ leave headless contract output unchanged" || { echo "FAIL"; exit 1; }
