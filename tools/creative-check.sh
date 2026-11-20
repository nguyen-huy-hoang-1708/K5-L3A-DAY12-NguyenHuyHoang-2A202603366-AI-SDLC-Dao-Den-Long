#!/usr/bin/env bash
# Proof that creative additions (client-only, in web/) do not change contract headless output.
#  1) Static: the headless path (headless/, src/) never imports anything from web/.
#  2) Dynamic: headless output is byte-identical between BASE (default: tag ui-classic) and the working tree,
#     for every fixture in tests/scenarios and full default nights on several seeds.
# Usage: tools/creative-check.sh [base-ref]   (default: tag ui-classic = Phase 1 before the xianxia UI)
set -u
cd "$(dirname "$0")/.."
BASE=${1:-ui-classic}
echo "== creative-check: base=$BASE ($(git rev-parse --short "$BASE")) vs HEAD=$(git rev-parse --short HEAD)$(git diff --quiet -- src headless || echo ' +uncommitted')"
fail=0
if grep -rnE "from ['\"][./]*web/|require\(['\"][./]*web/" src headless; then echo "FAIL: headless path imports web/"; fail=1; else echo "ok   headless/ and src/ do not import web/"; fi
echo "     files changed since $BASE: $(git diff --name-only "$BASE" -- . | tr '\n' ' ')"
core=$(git diff --name-only "$BASE" -- src headless game.contract.json | tr '\n' ' ')
echo "     of which in headless path (src/ headless/ game.contract.json): ${core:-none}"
TMP=$(mktemp -d); trap 'git worktree remove --force "$TMP/base" >/dev/null 2>&1; rm -rf "$TMP"' EXIT
git worktree add -q --detach "$TMP/base" "$BASE"
run() { # $1=root $2=out $3..=args
  local root=$1 out=$2; shift 2; node "$root/headless/run.js" --night 1 --out "$out" "$@"
}
n=0
for d in tests/scenarios/*/; do
  name=$(basename "$d"); args=(--seed 5 --ticks 1800)
  [ -f "$d/scenario.json" ] && args+=(--scenario "$PWD/$d/scenario.json")
  [ -f "$d/inputs.json" ] && args+=(--inputs "$PWD/$d/inputs.json")
  run "$TMP/base" "$TMP/a.jsonl" "${args[@]}"; run "$PWD" "$TMP/b.jsonl" "${args[@]}"
  if cmp -s "$TMP/a.jsonl" "$TMP/b.jsonl"; then echo "ok   fixture $name identical ($(wc -l < "$TMP/a.jsonl" | tr -d ' ') lines)"; else echo "FAIL fixture $name differs"; fail=1; fi
  n=$((n+1))
done
for seed in 1 7 42 2026; do
  run "$TMP/base" "$TMP/a.jsonl" --seed $seed --ticks 18000 --scenario "$PWD/tests/scenarios/default_spawn/scenario.json"
  run "$PWD" "$TMP/b.jsonl" --seed $seed --ticks 18000 --scenario "$PWD/tests/scenarios/default_spawn/scenario.json"
  h=$(shasum -a 256 "$TMP/b.jsonl" | cut -c1-16)
  if cmp -s "$TMP/a.jsonl" "$TMP/b.jsonl"; then echo "ok   full night seed $seed identical (sha256 $h…)"; else echo "FAIL full night seed $seed differs"; fail=1; fi
done
[ $fail = 0 ] && echo "PASS: creative additions leave headless contract output unchanged" || { echo "FAIL"; exit 1; }
