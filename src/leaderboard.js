// Local leaderboard rules (Ticket-04 §3). Pure; used by the client, the server and tests.
export const LB_MAX = 10;
// 3–12 characters of [A-Za-z0-9_]; Vietnamese letters with diacritics are also accepted (bonus).
const NAME_RE = /^[\p{L}\p{M}\p{N}_]{3,12}$/u;

export function normalizeName(name) {
  return typeof name === 'string' ? name.trim().normalize('NFC') : '';
}
/** Returns null when valid, otherwise a Vietnamese error message. */
export function nameError(name) {
  const n = normalizeName(name);
  const len = [...n].length;
  if (len < 3 || len > 12) return 'Tên cần 3–12 ký tự';
  if (!NAME_RE.test(n)) return 'Chỉ dùng chữ, số và dấu gạch dưới _';
  return null;
}
/** ISO 8601 with the local time-zone offset, e.g. 2026-11-20T15:04:05+07:00. */
export function isoLocal(d = new Date()) {
  const p = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` +
    `${off >= 0 ? '+' : '-'}${p(off / 60)}:${p(off % 60)}`;
}
export function validEntry(e) {
  return !!e && nameError(e.name) === null && Number.isInteger(e.score) && e.score >= 0 &&
    Number.isInteger(e.nights_won) && e.nights_won >= 0 && e.nights_won <= 3 &&
    typeof e.achieved_at === 'string' && !Number.isNaN(Date.parse(e.achieved_at)) && Number.isInteger(e.seed);
}
/** Insert and keep the top 10: score desc, then earlier achieved_at first, then earlier insertion first. */
export function addEntry(entries, entry) {
  if (!validEntry(entry)) throw new Error('invalid leaderboard entry');
  const e = { name: normalizeName(entry.name), score: entry.score, nights_won: entry.nights_won, achieved_at: entry.achieved_at, seed: entry.seed };
  const all = [...entries, e].map((x, i) => [x, i]);
  all.sort(([a, i], [b, j]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || i - j);
  return all.slice(0, LB_MAX).map(([x]) => x);
}
