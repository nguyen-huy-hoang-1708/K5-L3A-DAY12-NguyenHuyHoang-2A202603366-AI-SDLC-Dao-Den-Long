// Standard maps (Ticket-02 Part 2). Angle a at radius r around (cx, cz) -> (cx + r cos a, y, cz + r sin a).
const D = Math.PI / 180;
const ring = (n, r, start, step, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = (start + i * step) * D;
    return [round3(cx + r * Math.cos(a)), y, round3(cz + r * Math.sin(a))];
  });
function round3(v) {
  const x = Math.round(v * 1000) / 1000;
  return Object.is(x, -0) ? 0 : x;
}

const RAMP_ANGLES = [30 * D, 150 * D];

/** Highest walkable surface at (x, z), or null over the sea of clouds. */
const SURFACE = {
  1: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
  2: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
  3: (x, z) => {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r <= 2) return 14; // bell tower (8 m above tier 2) — a wall
    if (r <= 8) return 6; // tier 2
    let h = 0;
    if (z > 0 && r >= 12 && r <= 24) h = 3; // tier 1 (half ring, z > 0)
    for (const a of RAMP_ANGLES) {
      const u = x * Math.cos(a) + z * Math.sin(a);
      const v = -x * Math.sin(a) + z * Math.cos(a);
      if (Math.abs(v) <= 1.5 && u >= 24 && u <= 30) h = Math.max(h, (3 * (30 - u)) / 6);
    }
    return h;
  },
};

export const MAPS = {
  1: {
    name: 'Đảo Bến',
    duration_s: 300,
    start: [0, 0, 0],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
    shadePoints: ring(12, 37, 15, 30, 0),
    shadeEvery: 480,
    shadeMax: 6,
    shadeSpeed: 4.0,
    pads: [],
    charms: [],
    drifters: false,
    wind: false,
    surface: SURFACE[1],
  },
  2: {
    name: 'Đảo Cau',
    duration_s: 330,
    start: [0, 0, 0],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [
      ...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45),
      ...ring(4, 10, 0, 90, 0, 70), ...ring(8, 22, 0, 45, 0, 70),
    ],
    shadePoints: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 0, 70)],
    shadeEvery: 420,
    shadeMax: 8,
    shadeSpeed: 4.0,
    pads: [
      { pos: [20, 0, 18], vy: 14, h: 24, target: [70, 0, 0] },
      { pos: [50, 0, -18], vy: 14, h: 24, target: [0, 0, 0] },
    ],
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    drifters: true,
    wind: false,
    surface: SURFACE[2],
  },
  3: {
    name: 'Đảo Chuông',
    duration_s: 360,
    start: [0, 0, -30],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(18, 34, 0, 20, 0), ...ring(8, 18, 20, 20, 3), ...ring(4, 5, 45, 90, 6)],
    shadePoints: ring(16, 43, 0, 22.5, 0),
    shadeEvery: 360,
    shadeMax: 10,
    shadeSpeed: 4.5,
    pads: [{ pos: [0, 3, 13], vy: 12, h: 8, dir: [0, -1] }],
    charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
    drifters: true,
    wind: true,
    surface: SURFACE[3],
  },
};
