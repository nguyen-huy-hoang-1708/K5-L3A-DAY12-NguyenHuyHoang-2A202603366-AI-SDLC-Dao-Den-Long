// Ticket-04 benchmark scene + statistics (pure, shared by the web client, tools/bench.js and tests).
import { mulberry32 } from './sim.js';

export const BENCH = Object.freeze({ SHADES: 200, MOTES: 100, RADIUS: 38, WARMUP_S: 3, CAM_R: 30, CAM_Y: 15, CAM_PERIOD_S: 15 });

/** Standard bench scenario: 200 wandering shades + 100 motes spread uniformly over the island, L1–L3 lit (fuel 100). */
export function benchScenario(seed = 42) {
  const rng = mulberry32(seed);
  const point = (y) => {
    const r = BENCH.RADIUS * Math.sqrt(rng());
    const a = rng() * 2 * Math.PI;
    return [Math.round(r * Math.cos(a) * 1000) / 1000, y, Math.round(r * Math.sin(a) * 1000) / 1000];
  };
  const shades = Array.from({ length: BENCH.SHADES }, (_, i) => ({ id: `S${i + 1}`, pos: point(1), state: 'wander' }));
  const motes = Array.from({ length: BENCH.MOTES }, () => point(0));
  return {
    player: { pos: [0, 0, 0] },
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    charms: [], drifters: [], shades, motes,
    lanterns: [1, 2, 3].map((i) => ({ id: `L${i}`, lit: true, fuel: 100 })),
  };
}

/** Camera orbit: radius 30 m, Y = 15, starts at angle 0 = (30, 15, 0), counter-clockwise seen from above, 15 s per lap. */
export function benchCamera(tSec) {
  const a = (2 * Math.PI * tSec) / BENCH.CAM_PERIOD_S;
  return [BENCH.CAM_R * Math.cos(a), BENCH.CAM_Y, BENCH.CAM_R * Math.sin(a)];
}

/** Ticket-04 definitions over per-frame times dt (ms). */
export function benchStats(dts) {
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)]; // nearest-rank percentile
  const r1 = (v) => Math.round(v * 10) / 10;
  return {
    frames: N,
    avg_fps: r1((1000 * N) / sum),
    p1_low_fps: r1(1000 / (worst.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: Math.round(p95 * 100) / 100,
  };
}
