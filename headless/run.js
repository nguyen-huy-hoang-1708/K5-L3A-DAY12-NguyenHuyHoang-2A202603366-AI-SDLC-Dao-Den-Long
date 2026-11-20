#!/usr/bin/env node
// Headless runner — Test Contract v1.0 §B.
// node headless/run.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out <f.jsonl> [--snapshot-every 10]
import fs from 'node:fs';
import { createGame, step, snapshot, ScenarioError } from '../src/sim.js';
import { parseInputs, InputTimeline } from '../src/inputs.js';

function fail(msg, code) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = { snapshotEvery: 10 };
  const intArg = (name, v) => {
    if (v === undefined || !/^-?\d+$/.test(v)) fail(`${name} needs an integer`, 1);
    return Number(v);
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case '--seed': a.seed = intArg(k, v); i++; break;
      case '--night': a.night = intArg(k, v); i++; break;
      case '--ticks': a.ticks = intArg(k, v); i++; break;
      case '--snapshot-every': a.snapshotEvery = intArg(k, v); i++; break;
      case '--scenario': if (!v) fail('--scenario needs a path', 1); a.scenario = v; i++; break;
      case '--inputs': if (!v) fail('--inputs needs a path', 1); a.inputs = v; i++; break;
      case '--out': if (!v) fail('--out needs a path', 1); a.out = v; i++; break;
      default: fail(`unknown argument ${k}`, 1);
    }
  }
  if (a.seed === undefined) fail('--seed is required', 1);
  if (a.ticks === undefined || a.ticks < 0) fail('--ticks >= 0 is required', 1);
  if (!a.out) fail('--out is required', 1);
  if (a.night === undefined) a.night = 1;
  if (a.night !== 1) fail(`--night ${a.night} not supported (only 1)`, 1);
  if (a.snapshotEvery < 1) fail('--snapshot-every must be >= 1', 1);
  return a;
}

function readJson(path, what) {
  let text;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch (e) {
    fail(`cannot read ${what} ${path}: ${e.message}`, 2);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(`${what} ${path} is not valid JSON: ${e.message}`, 2);
  }
}

const args = parseArgs(process.argv.slice(2));
let game;
let timeline;
try {
  const scenario = args.scenario ? readJson(args.scenario, 'scenario') : null;
  game = createGame({ seed: args.seed, night: args.night, scenario });
  const frames = args.inputs ? parseInputs(readJson(args.inputs, 'inputs')) : [];
  timeline = new InputTimeline(frames);
} catch (e) {
  fail(e.message, e instanceof ScenarioError ? 2 : 1);
}

const lines = [];
const write = (o) => lines.push(JSON.stringify(o));
write(snapshot(game));
for (let k = 0; k < args.ticks && game.state === 'playing'; k++) {
  const evs = step(game, timeline.at(k));
  for (const e of evs) write(e);
  if (game.tick % args.snapshotEvery === 0) write(snapshot(game));
}
write({ type: 'end', ticks: game.tick, state: game.state, score: game.score });

try {
  fs.writeFileSync(args.out, lines.join('\n') + '\n');
} catch (e) {
  fail(`cannot write ${args.out}: ${e.message}`, 1);
}
process.exit(0);
