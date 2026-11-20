// Fails if game.contract.json tuning drifts from the numbers the sim actually uses.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { contractTuning } from '../src/sim.js';
const c = JSON.parse(fs.readFileSync(new URL('../game.contract.json', import.meta.url)));
assert.equal(c.contract_version, '1.2');
for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof c[k], 'string', k);
assert.deepEqual(c.tuning, contractTuning());
console.log('game.contract.json tuning matches src/sim.js TUNING');
