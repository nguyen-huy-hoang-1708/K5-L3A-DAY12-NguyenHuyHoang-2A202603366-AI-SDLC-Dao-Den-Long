// Remappable controls (Ticket-04 §4). Pure module: used by the client and tests/keymap.test.js.
export const ACTIONS = [
  ['up', 'Đi tới'], ['down', 'Đi lùi'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác'], ['pulse', 'Tỏa Sáng'], ['pause', 'Tạm dừng'],
];
export const DEFAULT_KEYS = Object.freeze({
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape',
});
/** Complete a stored map with defaults (unknown actions ignored). */
export function withDefaults(keys) {
  const out = { ...DEFAULT_KEYS };
  if (keys && typeof keys === 'object') for (const [a] of ACTIONS) if (typeof keys[a] === 'string' && keys[a]) out[a] = keys[a];
  return out;
}
/** Map key code -> actions bound to it, only for codes used more than once. */
export function duplicates(keys) {
  const by = {};
  for (const [a] of ACTIONS) (by[keys[a]] ||= []).push(a);
  return Object.fromEntries(Object.entries(by).filter(([, v]) => v.length > 1));
}
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', ControlLeft: 'Ctrl trái', AltLeft: 'Alt trái' }[code] || code;
}
