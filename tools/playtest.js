#!/usr/bin/env node
// Real-client playtest: starts the static server, opens the game in headless Chrome (CDP, no deps), plays it with a
// keyboard bot (real key events), checks menus/pause/settings, measures FPS at 1280x720, saves screenshots + JSON.
// Usage: node tools/playtest.js [--out dir] [--mode campaign|lose] [--seed 7] [--speed 4] [--lit 4] [--night 1] [--gpu]
//   campaign: menu -> night 1 -> 2 -> 3 -> dawn. --lit K pre-lights the first K lanterns of each night (debug URL
//             parameter, shortens the run); the bot still has to collect, deposit and light the remaining ones.
//   lose:     night 1, bot walks into the shades until it loses, then retries the night.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'docs/proof/phase-2/playtest')));
const MODE = arg('--mode', 'campaign');
const SEED = Number(arg('--seed', 7));
const SPEED = Number(arg('--speed', 4));
const LIT = Number(arg('--lit', MODE === 'campaign' ? 4 : 0));
const GPU = process.argv.includes('--gpu');
const START = Number(arg('--night', 1));
const EXTRA = arg('--extra', ''); // extra debug URL parameters, e.g. '&fuel=25' // campaign start night (uses the ?night= debug parameter)
const PORT = 8000 + Math.floor(Math.random() * 900);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error('Chrome/Chromium not found (set CHROME=path)'); process.exit(1); }
const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--no-open', '--port', String(PORT)], { stdio: 'ignore' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-chrome-'));
const gl = GPU ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,720', ...gl, '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const cleanup = () => { chrome.kill(); server.kill(); };
process.on('exit', cleanup);

const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
  setTimeout(() => rej(new Error('chrome did not start')), 15000);
});
const targets = await (await fetch(wsUrl.replace('ws://', 'http://').replace(/\/devtools\/browser.*/, '/json'))).json();
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(JSON.stringify(msg.params.args.map((a) => a.value ?? a.description)));
};
const cdp = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const js = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;
const shot = async (name) => {
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  console.log(`  saved ${name}.png`);
};
const KEY = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyF: 'f', KeyQ: 'q', KeyR: 'r', KeyP: 'p', Space: ' ', Enter: 'Enter', Escape: 'Escape' };
const held = new Set();
const key = (code, down) => cdp('Input.dispatchKeyEvent', { type: down ? 'keyDown' : 'keyUp', code, key: KEY[code] });
async function hold(codes) {
  for (const c of [...held]) if (!codes.includes(c)) { await key(c, false); held.delete(c); }
  for (const c of codes) if (!held.has(c)) { await key(c, true); held.add(c); }
}
const tap = async (code) => { await key(code, true); await sleep(50); await key(code, false); };
const ui = () => js('window.__ui ? window.__ui.screen : null');
const state = () => js(`(() => { const g = window.__game; if (!g) return null; return { night: g.night, tick: g.tick, state: g.state, score: g.score, p: g.player.pos, dead: g.player.dead,
  carried: g.player.carried, flames: g.player.flames, pulseCd: g.player.pulseCdT, motes: g.motes.map(m => m.pos),
  lanterns: g.lanterns.map(l => ({ id: l.id, pos: l.pos, lit: l.lit, dep: l.deposited, fuel: l.fuelU / 60, ever: l.everLit })), cap: Math.min(20, 10 + 2 * g.player.successful), shades: g.shades.map(s => ({ pos: s.pos, state: s.state })),
  hud: [...document.querySelectorAll('#hud .pill')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()) }; })()`);

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await cdp('Page.navigate', { url: `http://localhost:${PORT}/web/?seed=${SEED}&speed=${SPEED}${LIT ? `&lit=${LIT}` : ''}${START > 1 ? `&night=${START}` : ''}${EXTRA}` });
await sleep(2500);
const report = { mode: MODE, seed: SEED, speed: SPEED, lit: LIT, gpu: GPU, nights: [], checks: {}, errors };
await shot('01-menu');
report.checks.menu = (await ui()) === 'menu';
await tap('Enter');
await sleep(500);
report.checks.intro = (await ui()) === 'intro';
await shot(`02-intro-night${START}`);

// Route on night 2: cross between islands by the bridge (z in [-2, 2]).
function waypoint(s, target) {
  const P = s.p;
  if (s.night === 2) {
    const side = (x) => (x < 35 ? 'A' : 'B');
    if (side(P[0]) !== side(target[0])) {
      const onBridge = P[0] > 24 && P[0] < 46 && Math.abs(P[2]) < 1.2;
      if (!onBridge) return [side(P[0]) === 'A' ? 24 : 46, 0, 0];
      return [side(target[0]) === 'A' ? 22 : 48, 0, 0];
    }
  }
  return target;
}
const reachable = (s, p) => (s.night !== 3 ? (s.night !== 2 || true) : p[1] === 0);

async function playNight(n) {
  await tap('Enter'); // start the night from its intro card
  await sleep(300);
  const t0 = Date.now();
  let shotDone = false;
  let lastPulse = 0;
  while (Date.now() - t0 < 240000) {
    const s = await state();
    const scr = await ui();
    if (!s || s.state !== 'playing' || scr !== 'play') break;
    const P = s.p, d = (q) => Math.hypot(q[0] - P[0], q[2] - P[2]);
    const unlit = s.lanterns.filter((l) => !l.lit && reachable(s, l.pos)).sort((a, b) => d(a.pos) - d(b.pos));
    let target = null, interact = false;
    if (MODE === 'lose') target = s.shades.length ? s.shades[0].pos : [0, 0, 8];
    else {
      // Ticket-03 goal: keep >= ceil(0.6 n) lanterns lit until dawn. Refuel weak lanterns first, then light more.
      const needLit = Math.ceil((s.lanterns.length * 6) / 10);
      const litN = s.lanterns.filter((l) => l.lit).length;
      const weak = s.lanterns.filter((l) => l.lit && l.fuel < 55 && reachable(s, l.pos)).sort((a, b) => a.fuel - b.fuel);
      const cost = (l) => (l.ever ? 5 : 10) - l.dep;
      const goal = weak.length && s.carried >= 3 ? weak[0] : litN <= needLit && unlit.length && s.carried >= Math.min(cost(unlit[0]), s.cap) ? unlit[0] : null;
      if (goal || (s.carried > 0 && s.motes.filter((m) => reachable(s, m)).length === 0 && unlit.length)) {
        target = (goal || unlit[0]).pos;
        interact = d(target) <= 1.6;
      } else {
        const motes = s.motes.filter((m) => reachable(s, m)).sort((a, b) => d(waypoint(s, a)) - d(waypoint(s, b)));
        target = motes[0] || (unlit[0] && unlit[0].pos) || null;
      }
      const threat = s.shades.find((x) => (x.state === 'chase' || x.state === 'wander') && d(x.pos) < 3.5);
      if (threat && s.carried >= 3 && s.pulseCd === 0 && Date.now() - lastPulse > 500) { await tap('KeyF'); lastPulse = Date.now(); }
      else if (threat) {
        // No pulse available: dash and run into the safe zone of the nearest lit lantern.
        const safe = s.lanterns.filter((l) => l.lit && reachable(s, l.pos)).sort((a, b) => d(a.pos) - d(b.pos))[0];
        if (safe && d(safe.pos) > 3) { target = safe.pos; interact = false; await tap('KeyQ'); }
      }
    }
    const codes = [];
    if (target && !interact) {
      const w = waypoint(s, target);
      const dx = w[0] - P[0], dz = w[2] - P[2];
      if (dz > 0.25) codes.push('KeyW');
      if (dz < -0.25) codes.push('KeyS');
      if (dx > 0.25) codes.push('KeyA');
      if (dx < -0.25) codes.push('KeyD');
    }
    await hold(codes);
    if (interact) { await tap('KeyE'); await sleep(80); }
    if (!shotDone && s.tick > 900) { shotDone = true; await shot(`03-night${n}-play`); }
    if (EXTRA && !report.checks.drainShot && s.shades.some((x) => x.state === 'drain')) { report.checks.drainShot = true; await shot(`09-night${n}-drain`); }
    if (EXTRA && !report.checks.outShot && s.lanterns.some((l) => !l.lit && l.ever)) { report.checks.outShot = true; await shot(`10-night${n}-lantern-out`); }
    if (n === 1 && MODE === 'campaign' && !report.checks.pause) {
      // Pause check: logic must stop; settings persist.
      await hold([]);
      await tap('Escape');
      await sleep(300);
      const a = await state();
      await sleep(600);
      const b = await state();
      report.checks.pause = (await ui()) === 'paused' && a.tick === b.tick;
      await shot('04-pause-menu');
      await js(`document.getElementById('b-set').click()`);
      await sleep(200);
      await js(`(() => { const v = document.getElementById('s-vol'); v.value = 0.35; v.dispatchEvent(new Event('input')); const s = document.getElementById('s-sens'); s.value = 1.7; s.dispatchEvent(new Event('input')); const c = document.getElementById('s-cb'); if (c) { c.checked = true; c.dispatchEvent(new Event('change')); } })()`);
      await shot('05-settings');
      await js(`document.getElementById('b-back').click()`);
      await sleep(200);
      await js(`document.getElementById('b-res').click()`);
      await sleep(300);
      report.checks.resumed = (await ui()) === 'play';
    }
    await sleep(35);
  }
  await hold([]);
  await sleep(700);
  const s = await state();
  const fps = await js('window.__perf.samples.slice(-60)');
  report.nights.push({ night: n, state: s.state, score: s.score, flames: s.flames, tick: s.tick, hud: s.hud, fps_samples: fps });
  await shot(`06-night${n}-${s.state}`);
  return s.state;
}

if (MODE === 'campaign') {
  for (const n of [1, 2, 3].filter((x) => x >= START)) {
    const r = await playNight(n);
    if (r !== 'won') break;
    if (n < 3) {
      await sleep(300);
      report.checks[`result${n}`] = (await ui()) === 'result';
      await tap('Enter');
      await sleep(500);
      report.checks[`intro${n + 1}`] = (await ui()) === 'intro';
      await shot(`02-intro-night${n + 1}`);
    }
  }
  await sleep(1800);
  report.checks.dawn = (await ui()) === 'dawn';
  report.total = await js('Object.values(window.__ui.won).reduce((a, b) => a + b, 0)');
  if (report.checks.dawn) await shot('07-dawn');
  // Settings persisted across a reload.
  await cdp('Page.reload');
  await sleep(2500);
  report.checks.settings_persisted = await js('window.__ui.settings.volume === 0.35 && window.__ui.settings.sens === 1.7 && window.__ui.settings.colorblind !== false');
} else {
  await playNight(START);
  await sleep(300);
  report.checks.result = (await ui()) === 'result';
  await tap('KeyR');
  await sleep(600);
  const s = await state();
  report.checks.retry_same_night = (await ui()) === 'intro' && s.night === START && s.tick === 0;
  await shot('08-retry');
}
const all = report.nights.flatMap((x) => x.fps_samples || []);
report.fps = { gl: GPU ? 'gpu (metal)' : 'swiftshader (software)', mean: all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 10) / 10 : null, min: all.length ? Math.min(...all) : null, samples: all.length };
fs.writeFileSync(path.join(OUT, `result-${MODE}${GPU ? '-gpu' : ''}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ nights: report.nights.map(({ fps_samples, hud, ...r }) => r), checks: report.checks, total: report.total, fps: report.fps, errors }, null, 2));
cleanup();
const ok = errors.length === 0 && Object.values(report.checks).every(Boolean) && (MODE !== 'campaign' || report.checks.dawn);
process.exit(ok ? 0 : 1);
