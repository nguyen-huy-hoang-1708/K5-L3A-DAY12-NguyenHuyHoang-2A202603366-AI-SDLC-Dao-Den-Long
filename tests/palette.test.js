// P2-21: standard palette (±10% per RGB channel) and ambient light formula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PALETTE, PALETTE_CB, ambientIntensity } from '../web/palette.js';

const TICKET = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', cloudSea: '#12384A',
  lanternLit: '#FFB347', lanternCore: '#FFE9B0', lanternOff: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shadeBody: '#120A1A', shadeRim: '#7A3CFF', shadeStunned: '#3A3450', robe: '#E8E2D0', scarf: '#C8102E', charm: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', uiDanger: '#FF5A5F', uiText: '#F5F1E6',
};
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test('palette matches Ticket-02 within 10% per channel', () => {
  for (const [k, want] of Object.entries(TICKET)) {
    const got = rgb(PALETTE[k]);
    rgb(want).forEach((w, i) => assert.ok(Math.abs(got[i] - w) <= 25.5, `${k} channel ${i}: ${PALETTE[k]} vs ${want}`));
  }
});

test('ambient = 0.15 + 0.55 x progress', () => {
  assert.equal(ambientIntensity(0, 5), 0.15);
  assert.ok(Math.abs(ambientIntensity(5, 5) - 0.7) < 1e-12);
  assert.ok(Math.abs(ambientIntensity(3, 6) - 0.425) < 1e-12);
});

test('client uses the palette module for listed elements (no stray hard-coded sky/fog)', () => {
  const src = fs.readFileSync(new URL('../web/main.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../web/world.js', import.meta.url), 'utf8');
  assert.match(src, /from '\.\/palette\.js'/);
  assert.match(src, /ambientIntensity\(/);
  assert.match(src, /PALETTE\.sky/);
  assert.match(src, /PALETTE\.fog/);
});

test('P3-13 colour-blind palette: shade rim/eyes #00B3FF, UI warning #FFFFFF', () => {
  assert.deepEqual({ ...PALETTE_CB }, { shadeRim: '#00B3FF', uiDanger: '#FFFFFF' });
  const src = fs.readFileSync(new URL('../web/main.js', import.meta.url), 'utf8');
  assert.match(src, /PALETTE_CB/);
  assert.match(src, /colorblind/);
});
