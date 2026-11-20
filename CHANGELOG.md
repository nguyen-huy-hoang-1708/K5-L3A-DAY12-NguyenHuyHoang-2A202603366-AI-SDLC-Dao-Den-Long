# Changelog

## phase-1 — PRD-0 + Test Contract v1.0
- Luật chơi tất định `src/sim.js` (nhặt đom đóm, nạp/thắp đèn, Bóng Mực đuổi, tỏa sáng, vùng an toàn, thắng/thua, điểm).
- CLI headless `headless/run.js` theo Test Contract v1.0; `game.contract.json`.
- Client 3D Three.js `web/` với HUD, chơi lại, âm thanh tự tổng hợp.
- 33 test (unit, scenario qua CLI, tất định, mã lỗi), mutation check, playtest client thật, CI.
- Harness: AGENTS.md, skill `verify`, hook Stop chặn khi test đỏ.
