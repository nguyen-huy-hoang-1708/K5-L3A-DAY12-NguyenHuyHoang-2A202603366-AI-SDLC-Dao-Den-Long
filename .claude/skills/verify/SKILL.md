---
name: verify
description: Run the full verification for the current phase and save evidence (tests, headless fixtures, determinism, real-client playtest screenshots). Use before tagging a phase or when asked "is it done / prove it".
---

# Verify a phase and save evidence

1. `npm test` — must be green. If red: fix, do not edit expected values to match wrong output.
2. `tools/mutation-check.sh` — every mutation must be *caught*. A survivor means a test is too weak: add a test.
3. `node tools/proof.js phase-N` — writes `docs/proof/phase-N/headless/` (test report, fixture JSONL, determinism hashes, timing).
4. `node tools/playtest.js --mode win --out docs/proof/phase-N/playtest` then `--mode lose` — drives the real 3D client in headless Chrome with real key events; saves screenshots + `result-*.json`. Exit 0 = game ended and replay started with no console errors.
5. Update the traceability table in `docs/proof/phase-N/README.md` (requirement → how verified → evidence → result). Mark anything not met as **chưa đạt** with the reason.
6. Never hand-edit generated evidence files.
