// Standard palette (Ticket-02 Part 3). Every listed element in the client reads its colour from here;
// tests/palette.test.js checks each value against the ticket (max 10% deviation per RGB channel).
export const PALETTE = Object.freeze({
  sky: '#0E1430',
  fog: '#1B2350',
  grass: '#2F5D50',
  sand: '#C9B48A',
  wood: '#6B4A2F',
  cloudSea: '#12384A',
  lanternLit: '#FFB347',
  lanternCore: '#FFE9B0',
  lanternOff: '#5B5F6E',
  moteCore: '#FFF6C2',
  moteHalo: '#FFE58A',
  shadeBody: '#120A1A',
  shadeRim: '#7A3CFF',
  shadeStunned: '#3A3450',
  robe: '#E8E2D0',
  scarf: '#C8102E',
  charm: '#C8102E',
  gold: '#F2C14E',
  drifter: '#8FA3B8',
  uiDanger: '#FF5A5F',
  uiText: '#F5F1E6',
});

/** Environment light intensity from progress (Ticket-02): 0.15 + 0.55 × lit/total. */
export const ambientIntensity = (lit, total) => 0.15 + 0.55 * (total ? lit / total : 0);
