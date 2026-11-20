#!/usr/bin/env node
// Real-client playtest: starts the static server, opens the 3D game in headless Chrome (CDP, no deps),
// plays it with a simple keyboard bot (real key events), saves screenshots + a JSON log as evidence.
// Usage: node tools/playtest.js [--out docs/proof/phase-1/playtest] [--seed 7] [--speed 4] [--mode win|lose]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const OUT = path.resolve(arg('--out', path.join(ROOT, 'docs/proof/phase-1/playtest')));
const SEED = Number(arg('--seed', 7));
const SPEED = Number(arg('--speed', 4));
const MODE = arg('--mode', 'win');
const PORT = 8000 + Math.floor(Math.random() * 900);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const CHROME = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].find((p) => p && fs.existsSync(p));
if (!CHROME) {
  console.error('Chrome/Chromium not found (set CHROME=path)');
  process.exit(1);
}

const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--no-open', '--port', String(PORT)], { stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,720', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const cleanup = () => {
  chrome.kill();
  server.kill();
};
process.on('exit', cleanup);

const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) res(m[1]);
  });
  setTimeout(() => rej(new Error('chrome did not start')), 15000);
});
const targets = await (await fetch(wsUrl.replace('ws://', 'http://').replace(/\/devtools\/browser.*/, '/json'))).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const cdp = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const evalJs = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const shot = async (name) => {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  saved ${name}.png`);
};
const KEYS = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyF: 'f', Space: ' ', Enter: 'Enter', KeyR: 'r' };
const held = new Set();
const key = (code, down) => cdp('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: KEYS[code] });
async function setHeld(codes) {
  for (const c of [...held]) if (!codes.includes(c)) { await key(c, false); held.delete(c); }
  for (const c of codes) if (!held.has(c)) { await key(c, true); held.add(c); }
}
const tap = async (code) => { await key(code, true); await sleep(60); await key(code, false); };

await cdp('Page.enable');
await cdp('Runtime.enable');
const consoleErrors = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(JSON.stringify(msg.params.args));
});
await sleep(500);
await cdp('Page.navigate', { url: `http://localhost:${PORT}/web/?seed=${SEED}&speed=${SPEED}` });
await sleep(2500);
await shot('01-title');
await tap('Enter');
await sleep(800);
await shot('02-start');

const log = [];
const snap = () => evalJs(`(() => { const g = window.__game; return { tick: g.tick, state: g.state, score: g.score, p: g.player.pos.map(v => +v.toFixed(2)), carried: g.player.carried, flames: g.player.flames, lit: g.lanterns.filter(l => l.lit).length, motes: g.motes.map(m => m.pos), lanterns: g.lanterns.map(l => ({ id: l.id, pos: l.pos, lit: l.lit, dep: l.deposited })), shades: g.shades.map(s => ({ id: s.id, pos: s.pos, state: s.state })), hud: [...document.querySelectorAll('.pill')].map(e => e.textContent) }; })()`);

// Keyboard bot. Camera yaw stays 0 => W=+Z, S=-Z, A=+X, D=-X (see web/main.js readInput).
const shots = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  const s = await snap();
  if (s.state !== 'playing') break;
  const P = s.p;
  const d = (q) => Math.hypot(q[0] - P[0], q[2] - P[2]);
  let target = null;
  let wantInteract = false;
  if (MODE === 'lose') {
    const sh = s.shades[0];
    target = sh ? sh.pos : null; // walk into the shades
  } else {
    const unlit = s.lanterns.filter((l) => !l.lit).sort((a, b) => d(a.pos) - d(b.pos));
    const need = unlit.length ? 5 - unlit[0].dep : 0;
    if (s.carried >= Math.min(need, 5) && unlit.length) {
      target = unlit[0].pos;
      wantInteract = d(target) <= 2.0;
    } else if (s.motes.length) {
      target = [...s.motes].sort((a, b) => d(a) - d(b))[0];
    }
    const threat = s.shades.find((x) => x.state !== 'stunned' && d(x.pos) < 3.5);
    if (threat && s.carried >= 2) await tap('KeyF');
  }
  const codes = [];
  if (target && !wantInteract) {
    const dx = target[0] - P[0];
    const dz = target[2] - P[2];
    if (dz > 0.3) codes.push('KeyW');
    if (dz < -0.3) codes.push('KeyS');
    if (dx > 0.3) codes.push('KeyA');
    if (dx < -0.3) codes.push('KeyD');
  }
  await setHeld(codes);
  if (wantInteract) {
    await tap('KeyE');
    await sleep(100);
  }
  log.push({ t: s.tick, state: s.state, score: s.score, carried: s.carried, flames: s.flames, lit: s.lit });
  if (s.lit >= 1 && !shots.has('lit1')) { shots.add('lit1'); await shot('03-first-lantern-lit'); }
  if (s.lit >= 3 && !shots.has('lit3')) { shots.add('lit3'); await shot('04-three-lanterns'); }
  if (MODE === 'lose' && s.flames < 3 && !shots.has('hit')) { shots.add('hit'); await shot('03-hit'); }
  await sleep(40);
}
await setHeld([]);
await sleep(600);
const fin = await snap();
await shot(MODE === 'lose' ? '05-lost' : '05-end');
// Replay: press R and check a fresh game started.
await tap('KeyR');
await sleep(600);
const replay = await snap();
await shot('06-replay');
const result = {
  mode: MODE,
  seed: SEED,
  speed: SPEED,
  final: { tick: fin.tick, state: fin.state, score: fin.score, flames: fin.flames, lit: fin.lit, hud: fin.hud },
  after_replay: { tick: replay.tick, state: replay.state, score: replay.score, lit: replay.lit, flames: replay.flames },
  console_errors: consoleErrors,
  samples: log.filter((_, i) => i % 25 === 0),
};
fs.writeFileSync(path.join(OUT, `result-${MODE}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ final: result.final, after_replay: result.after_replay, console_errors: consoleErrors }, null, 2));
cleanup();
process.exit(fin.state !== 'playing' && replay.state === 'playing' && replay.tick < 400 && consoleErrors.length === 0 ? 0 : 1);
