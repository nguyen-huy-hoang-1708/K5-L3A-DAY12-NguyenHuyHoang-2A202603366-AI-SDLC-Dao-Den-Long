---
name: verify
description: Run the full verification for the current phase and save evidence (tests, headless fixtures, determinism, real-client playtest screenshots). Use before tagging a phase or when asked "is it done / prove it".
---

# Verify a phase and save evidence

1. `npm test` — must be green. If red: fix, do not edit expected values to match wrong output.
2. `tools/mutation-check.sh` — every mutation must be *caught*. A survivor means a test is too weak: add a test.
3. `node tools/proof.js phase-N` — writes `docs/proof/phase-N/headless/` (test report, fixture JSONL, determinism hashes, timing).
4. `node tools/playtest.js --mode campaign --gpu --out docs/proof/phase-N/playtest` and `--mode lose --gpu --night K --out docs/proof/phase-N/playtest-lose-nK` — drives the real 3D client in headless Chrome with real key events (menu → nights → pause/settings → result/retry), measures FPS at 1280×720, saves screenshots + `result-*.json`. Use `--gpu` for FPS (SwiftShader is software, ~9 FPS). Report honestly which checks failed.
5. `tools/creative-check.sh > docs/proof/phase-N/creative-check.txt` — headless output must be byte-identical with `web/` removed (creative extras live in `web/` or are disabled headless).
6. Release phases: `node tools/bench.js ... --out bench.json` and `node --jitless --expose-gc headless/soak.js ... --out soak.json` — commit both JSON files; check thresholds (avg ≥ 60, p1 ≥ 30, load ≤ 10000 ms; crashes 0, mem_end ≤ 1.2 × mem_start). Compare headless output with the previous phase tag when the ticket does not change rules.
7. Update the traceability table in `docs/proof/phase-N/README.md` (requirement → how verified → evidence → result). Mark anything not met as **chưa đạt** with the reason.
8. Never hand-edit generated evidence files.
