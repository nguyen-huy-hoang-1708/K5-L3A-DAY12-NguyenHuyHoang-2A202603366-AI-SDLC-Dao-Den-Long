#!/usr/bin/env bash
# Claude Code Stop hook: refuse to finish while the test suite is red.
# Exit 2 => Claude is blocked from stopping and sees stderr. Avoid infinite loops via stop_hook_active.
input=$(cat)
if echo "$input" | grep -q '"stop_hook_active": *true'; then exit 0; fi
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
out=$(npm test --silent 2>&1)
if [ $? -ne 0 ]; then
  echo "npm test is failing — fix it (or record the failure honestly in docs/notes) before finishing:" >&2
  echo "$out" | grep -E "✖|not ok|Error|expected|actual" | head -30 >&2
  exit 2
fi
exit 0
