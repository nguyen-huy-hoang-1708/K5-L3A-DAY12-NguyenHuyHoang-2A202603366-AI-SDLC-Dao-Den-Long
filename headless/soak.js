#!/usr/bin/env node
// Soak test (Ticket-04 §2): 10 nights in one process (night 1 -> 2 -> 3 cycling), seeded random input.
// node --jitless --expose-gc headless/soak.js --seed 7 --nights 10 --out soak.json
// --jitless: with V8's optimising JIT the process RSS keeps growing from compiler memory although the JS heap is flat
// (see docs/proof/phase-4/README.md); jitless makes RSS reflect the game's own memory.
import fs from 'node:fs';
import { createGame, step, mulberry32, MAPS, TICK_RATE } from '../src/sim.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('--seed', 7));
const nights = Number(arg('--nights', 10));
const out = arg('--out', 'soak.json');
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  process.stderr.write('error: usage --seed <int> --nights <int> --out <file>\n');
  process.exit(1);
}
const gc = typeof global.gc === 'function' ? global.gc : () => {};
const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const heapMb = () => Math.round((process.memoryUsage().heapUsed / 1048576) * 10) / 10;
let heapStart = null;
const t0 = process.hrtime.bigint();
const results = [];
let crashes = 0;
let memStart = null;
let game = null;
for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  const s = seed + i;
  try {
    game = createGame({ seed: s, night });
    if (i === 0) { gc(); memStart = rssMb(); heapStart = heapMb(); }
    const rng = mulberry32(s);
    const maxTicks = MAPS[night].duration_s * TICK_RATE;
    let move = [0, 0];
    const held = { jump: false, dash: false, pulse: false, interact: false };
    for (let k = 0; k < maxTicks && game.state === 'playing'; k++) {
      if (k % 30 === 0) {
        const a = rng() * 2 * Math.PI;
        move = [Math.cos(a), Math.sin(a)];
      }
      held.jump = rng() < 0.05;
      held.dash = rng() < 0.03;
      held.pulse = rng() < 0.02;
      held.interact = rng() < 0.1;
      step(game, { move, cam_yaw_deg: 0, ...held, pause: false });
    }
    results.push(game.state);
  } catch (e) {
    crashes += 1;
    results.push('crash');
    process.stderr.write(`night ${i + 1} crashed: ${e.stack}\n`);
  }
  game = null; // reset
}
gc();
const memEnd = rssMb();
const report = {
  nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, heap_start_mb: heapStart, heap_end_mb: heapMb(),
  duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e7) / 100,
  seed, gc_exposed: typeof global.gc === 'function', jitless: process.execArgv.includes('--jitless'), node: process.version,
};
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
process.exit(0);
