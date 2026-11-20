// P4-7 / P4-10: key remapping rules and minimum UI font size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTIONS, DEFAULT_KEYS, withDefaults, duplicates, keyLabel } from '../web/keymap.js';

test('every action (4 moves, jump, dash, interact, pulse, pause) is remappable with defaults', () => {
  assert.deepEqual(ACTIONS.map(([a]) => a), ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause']);
  assert.deepEqual(Object.keys(DEFAULT_KEYS), ACTIONS.map(([a]) => a));
  assert.deepEqual(duplicates(DEFAULT_KEYS), {});
  assert.equal(withDefaults({ jump: 'KeyJ', bogus: 'KeyZ' }).jump, 'KeyJ');
  assert.equal(withDefaults({ jump: 'KeyJ' }).pulse, 'KeyF');
  assert.equal(keyLabel('KeyJ'), 'J');
});

test('duplicate keys are detected', () => {
  assert.deepEqual(duplicates({ ...DEFAULT_KEYS, pulse: 'KeyE' }), { KeyE: ['interact', 'pulse'] });
});

test('UI text is at least 18 px at 1280x720 (outside the small-screen media query)', () => {
  const html = fs.readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const css = html.replace(/@media \(max-width: 640px\)[^\n]*\n/g, '');
  const sizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 10);
  for (const s of sizes) assert.ok(s >= 18, `font-size ${s}px < 18px`);
  const js = fs.readFileSync(new URL('../web/main.js', import.meta.url), 'utf8');
  for (const m of js.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 18, m[0]);
  assert.match(html, /html\.big/);
});
