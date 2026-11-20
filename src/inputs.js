// Inputs file (Test Contract v1.0 §C): validation + per-tick lookup.
import { ScenarioError } from './sim.js';

const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];

export function parseInputs(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Array.isArray(obj.frames)) {
    throw new ScenarioError('inputs must be {"frames": [...]}');
  }
  let last = -1;
  return obj.frames.map((f, i) => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) throw new ScenarioError(`frames[${i}] must be an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new ScenarioError(`frames[${i}].tick must be int >= 0`);
    if (f.tick <= last) throw new ScenarioError(`frames[${i}].tick must strictly increase`);
    last = f.tick;
    const out = { tick: f.tick };
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every((v) => typeof v === 'number' && Number.isFinite(v))) {
        throw new ScenarioError(`frames[${i}].move must be [x, z]`);
      }
      out.move = [Math.max(-1, Math.min(1, m[0])), Math.max(-1, Math.min(1, m[1]))];
    }
    if ('cam_yaw_deg' in f) {
      if (typeof f.cam_yaw_deg !== 'number' || !Number.isFinite(f.cam_yaw_deg)) {
        throw new ScenarioError(`frames[${i}].cam_yaw_deg must be a number`);
      }
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const b of BUTTONS) {
      if (b in f) {
        if (typeof f[b] !== 'boolean') throw new ScenarioError(`frames[${i}].${b} must be boolean`);
        out[b] = f[b];
      }
    }
    return out;
  });
}

/** Stateful cursor: call at(k) for k = 0, 1, 2, ... in order. */
export class InputTimeline {
  constructor(frames = []) {
    this.frames = frames;
    this.i = 0;
    this.cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  }
  at(tick) {
    while (this.i < this.frames.length && this.frames[this.i].tick <= tick) {
      const { tick: _t, ...rest } = this.frames[this.i++];
      Object.assign(this.cur, rest);
    }
    return this.cur;
  }
}
