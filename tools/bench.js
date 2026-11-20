#!/usr/bin/env node
// Benchmark (Ticket-04 §1): node tools/bench.js --seed 42 --duration 30 --out bench.json [--headless]
// Opens Chrome in a real 1280×720 window (app mode, vsync off), loads the standard bench scene (web/?bench=1),
// waits 3 s warm-up + --duration s of measurement, writes bench.json and exits 0.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROCESS_START_MS = Date.now() - process.uptime() * 1000; // load_ms is measured from here
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = Number(arg('--seed', 42));
const DURATION = Number(arg('--duration', 30));
const OUT = arg('--out', 'bench.json');
const HEADLESS = process.argv.includes('--headless');
const fail = (m) => { process.stderr.write(`error: ${m}\n`); process.exit(1); };
if (!Number.isInteger(SEED) || !(DURATION > 0)) fail('usage: --seed <int> --duration <s> --out <file>');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && fs.existsSync(p));
if (!CHROME) fail('Chrome/Chromium not found (set CHROME=/path/to/chrome)');

const PORT = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--no-open', '--port', String(PORT)], { stdio: 'ignore', env: { ...process.env, DDL_DATA: path.join(os.tmpdir(), 'ddl-bench-lb.json') } });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const url = `http://localhost:${PORT}/web/?bench=1&seed=${SEED}&duration=${DURATION}`;
const flags = [
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', // vsync off
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--window-size=1280,720', '--window-position=40,40', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  ...(HEADLESS ? ['--headless=new', process.platform === 'darwin' ? '--use-angle=metal' : '--use-gl=angle'] : []),
  'about:blank',
];
const chrome = spawn(CHROME, flags, { stdio: ['ignore', 'ignore', 'pipe'] });
const cleanup = () => { try { chrome.kill(); } catch {} try { server.kill(); } catch {} };
process.on('exit', cleanup);

const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
  setTimeout(() => rej(new Error('chrome did not start')), 20000);
}).catch((e) => fail(e.message));
const base = wsUrl.replace('ws://', 'http://').replace(/\/devtools\/browser.*/, '');
const target = (await (await fetch(`${base}/json`)).json()).find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } };
const cdp = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (msg) => (msg.error ? rej(new Error(`${method}: ${msg.error.message}`)) : res(msg.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (e) => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;

// Make the drawable area exactly 1280×720 (window chrome differs per OS).
if (HEADLESS) await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
else {
  const { windowId } = await cdp('Browser.getWindowForTarget', { targetId: target.id });
  await sleep(800);
  await cdp('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
  await cdp('Browser.setWindowBounds', { windowId, bounds: { left: 40, top: 40, width: 1280, height: 720 } });
  for (let i = 0; i < 10; i++) {
    await sleep(300);
    const [w, h] = await js('[innerWidth, innerHeight]');
    if (w === 1280 && h === 720) break;
    const { bounds } = await cdp('Browser.getWindowBounds', { windowId });
    await cdp('Browser.setWindowBounds', { windowId, bounds: { width: bounds.width + (1280 - w), height: bounds.height + (720 - h) } });
  }
  console.error(`viewport before load: ${JSON.stringify(await js('[innerWidth, innerHeight, devicePixelRatio]'))}`);
}
await cdp('Page.navigate', { url });

// Memory sampler: RSS of every process using this Chrome profile + the server (sampled every 250 ms during measurement).
function rssMb() {
  try {
    const out = execFileSync('ps', ['-A', '-o', 'pid=,rss=,command='], { encoding: 'utf8', maxBuffer: 32 << 20 });
    let kb = 0;
    for (const line of out.split('\n')) {
      const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (m && (m[3].includes(profile) || Number(m[1]) === server.pid)) kb += Number(m[2]);
    }
    return kb / 1024;
  } catch { return null; }
}
let peak = null;
const t0 = Date.now();
let state = null;
while (Date.now() - t0 < (DURATION + 60) * 1000) {
  await sleep(250);
  try { state = await js('window.__bench && { phase: window.__bench.phase, first: window.__bench.first_frame_epoch_ms, result: window.__bench.result }'); } catch { state = null; }
  if (state && state.phase === 'measure') { const m = rssMb(); if (m !== null) peak = Math.max(peak ?? 0, m); }
  if (state && state.phase === 'done') break;
}
if (!state || state.phase !== 'done') { cleanup(); fail('bench did not finish'); }
const viewport = state.result.viewport;
const report = {
  contract_version: '1.3',
  avg_fps: state.result.avg_fps,
  p1_low_fps: state.result.p1_low_fps,
  frame_ms_p95: state.result.frame_ms_p95,
  frames: state.result.frames,
  load_ms: Math.round(state.first - PROCESS_START_MS),
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true,
  renderer: state.result.renderer,
  os: `${os.type()} ${os.release()} (${process.platform} ${os.arch()}), ${os.cpus()[0].model}, ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
  seed: SEED,
  duration_s: DURATION,
  window: HEADLESS ? 'headless 1280x720 (GPU)' : `window, drawable ${viewport[0]}x${viewport[1]}`,
  peak_mem_note: 'sum of RSS of all Chrome processes of the bench profile + the Node static server (web build)',
};
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
cleanup();
process.exit(0);
