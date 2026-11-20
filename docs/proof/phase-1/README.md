# Bằng chứng Phase 1 (tag `phase-1`)

Máy: MacBook Apple M1 Pro, macOS 15.7, Node v24.4.0, Chrome (headless, SwiftShader WebGL).
Mọi file trong `headless/`, `playtest/`, `mutation-check.txt` do script sinh ra, **không sửa tay**. Chạy lại ở tag:

```bash
npm test && tools/mutation-check.sh && node tools/proof.js phase-1
node tools/playtest.js --mode win --out docs/proof/phase-1/playtest && node tools/playtest.js --mode lose --out docs/proof/phase-1/playtest
```

## Truy vết yêu cầu → kiểm chứng → bằng chứng

| Yêu cầu (PRD-0 / Contract) | Tiêu chí | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| Game 3D, đảo tròn, 5 Đèn Lồng Lớn | AC19 | Playtest client thật | `playtest/02-start.png`, `04-three-lanterns.png` | Đạt |
| Đi lại, nhảy, camera 3D | AC2, AC3 | Unit (`camera yaw`, `normalized`, `jump`, `kept on island`) + scenario `walk_forward` | `headless/test-report.txt`, `headless/walk_forward.jsonl` | Đạt |
| Đom đóm rải rác, nhặt được | AC4, AC5, AC18 | Scenario `pickup`, `default_spawn`; unit `carry_capacity` | `headless/pickup.jsonl` (event tick 40) | Đạt |
| Nạp ánh sáng thắp đèn | AC6 | Scenario `light_one`; unit `deposit never exceeds`, `nearest unlit` | `headless/light_one.jsonl` | Đạt |
| Bóng Mực xuất hiện, đuổi, chạm mất máu | AC8, AC9, AC18 | Scenario `hit` (tick 35/155/275), `default_spawn` (`shade_spawned` tick 1800) | `headless/hit.jsonl`, `headless/default_spawn.jsonl` | Đạt |
| Tỏa sáng xua Bóng Mực, tốn ánh sáng | AC12, AC13 | Scenario `pulse`; unit cooldown, thiếu đom đóm, stunned không gây sát thương | `headless/pulse.jsonl` | Đạt |
| Bóng Mực sợ đèn (`safe_radius`) | AC14 | Scenario `safe_zone` 900 tick: mọi snapshot khoảng cách ≥ 5, không `player_hit` | `headless/safe_zone.jsonl` | Đạt (theo giả định A6: chỉ đèn đã thắp) |
| Thắng / thua (hết lửa, trời sáng) | AC7, AC10, AC11 | Scenario `win`, `lose_flames`, `hit`, `dawn` | `headless/*.jsonl`; `playtest/05-end.png` (thắng), `05-lost.png` (thua) | Đạt |
| Điểm số + HUD | AC6, AC7 | Điểm kiểm trong scenario (`win` = 549 = 100+299+150); HUD đọc từ DOM trong playtest | `playtest/result-win.json` (`hud`) | Đạt |
| Chơi lại sau thắng/thua | AC19 | Playtest nhấn `R` → game mới (tick nhỏ, điểm 0, 3 lửa) | `playtest/06-replay.png`, `result-*.json` `after_replay` | Đạt |
| Contract: `game.contract.json` khớp số thật | — | `tools/check-contract.js` (chạy trong `npm test`) + mutation M10 | `headless/test-report.txt` dòng đầu | Đạt |
| Contract: tham số CLI, mô hình tick, tick 0 trước input, sự kiện ghi `k+1` | AC1 | Scenario `idle` (61 snapshot, `time_left_s` 290 ở tick 600), `pickup`/`light_one` (event tick) | `headless/idle.jsonl` | Đạt |
| Contract: scenario không phát event/điểm | AC15 | Scenario `preset_lit`, `win` (snapshot tick 0 điểm 0) | `headless/preset_lit.jsonl` | Đạt |
| Contract: tất định | AC16 | 2 lần chạy so byte (unit), sha256 cả đêm 3 seed | `headless/README.md` bảng Determinism | Đạt |
| Contract: mã thoát 2 khi file sai | AC17 | Unit CLI 4 trường hợp | `headless/test-report.txt` | Đạt |
| Contract: toạ độ 3 chữ số, `end` là dòng cuối | — | Unit `output lines` | `headless/test-report.txt` | Đạt |
| Sáng tạo thêm không phá contract / headless | — | `tools/creative-check.sh` (so với tag `ui-classic`): không import `web/`, output byte-identical 12 fixture + 4 đêm | [creative-check.txt](creative-check.txt) | Đạt |
| Phong cách: ấm, vàng cam tốt, tím đen nguy hiểm, Mây đội nón lá treo đèn | — | Xem ảnh (đánh giá chủ quan) | `playtest/*.png` | Đạt (mức đơn giản) |

## Test có thật sự bắt lỗi không?

`tools/mutation-check.sh` cài 10 lỗi cố ý vào `src/sim.js` (tắt vùng an toàn, nạp vượt, bỏ bất tử, pulse miễn phí, sai dấu yaw, stun 1 s, làm tròn lên, không kết thúc lúc sáng, lệch tốc độ…). Kết quả: [mutation-check.txt](mutation-check.txt) — **10/10 bị bắt**.
Lần chạy đầu, lỗi "nạp vượt `lantern_cost`" **sống sót** (không test nào bắt) → đã thêm test `deposit never exceeds lantern_cost`.

## Ghi chú về ảnh playtest

Ảnh trong `playtest/` được chụp lại sau khi đổi giao diện sang phong cách tiên hiệp (chỉ client `web/`). Luật chơi và bằng chứng headless không đổi.

## Chưa đạt / giới hạn đã biết

- Playtest dùng bot đơn giản trong Chrome headless với `?speed=4` (chạy 4 bước sim mỗi tick hình) để nhanh; luật không đổi. Chưa đo FPS trên máy thật (Phase 1 không yêu cầu số đo).
- Hiệu năng hình ảnh trên máy yếu chưa kiểm tra.
- Video demo: chưa quay (thuộc Phase 4).

## Đánh giá Phase 1

- **Đạt:** toàn bộ phạm vi PRD-0 Phase 1 và Test Contract v1.0 theo tiêu chí AC1–AC19.
- **Hỏng phase trước:** không áp dụng (phase đầu).
- **AI sai ở đâu:** xem [docs/notes/ai-log.md](../../notes/ai-log.md).
- **Cần chỉnh cho phase sau:** giả định A6 (chỉ đèn đã thắp chặn Bóng Mực) và A16 (thưởng chỉ khi thắng) là chỗ rủi ro nhất với test ẩn — nếu ticket sau làm rõ khác, sửa `src/sim.js` + test + ghi lý do.
