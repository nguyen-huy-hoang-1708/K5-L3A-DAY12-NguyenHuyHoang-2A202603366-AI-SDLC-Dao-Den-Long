# Bằng chứng Phase 3 (tag `phase-3`) — Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

Máy: MacBook Apple M1 Pro, macOS 15.7, Node v24.4.0, Chrome headless (GPU Metal). Mọi file ở đây do script sinh ra, **không sửa tay**. Chạy lại ở tag:

```bash
npm test && tools/mutation-check.sh && node tools/proof.js phase-3 && tools/creative-check.sh
node tools/playtest.js --mode campaign --gpu --lit 5 --out docs/proof/phase-3/playtest
node tools/playtest.js --mode lose --gpu --lit 3 --extra "&fuel=28" --out docs/proof/phase-3/playtest-fuel
```

| File | Nội dung |
|---|---|
| [headless/README.md](headless/README.md) | 36 fixture + JSONL, hash tất định 3 Đêm, thời gian (≤ 0.32 s / Đêm) |
| [headless/test-report.txt](headless/test-report.txt) | `npm test`: contract v1.2 khớp code + 77 test |
| [mutation-check.txt](mutation-check.txt) | 39 lỗi cố ý (13 lỗi mới cho luật dầu/drain/bình minh) — **39/39 bị bắt** |
| [creative-check.txt](creative-check.txt) | Bỏ `web/` → output headless giống hệt |
| `playtest/` | Menu, tạm dừng, cài đặt (bật **Bảng màu dễ phân biệt**, lưu qua tải lại trang), HUD sức chứa, FPS |
| `playtest-fuel/` | `?lit=3&fuel=28`: đèn yếu, Bóng Mực hút dầu (`09-…-drain`), đèn tắt (`10-…-lantern-out`), chơi lại Đêm |

Thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md) · Test cũ bị thay: [phase-3.md §1](../../notes/phase-3.md) · Breaking changes: [CHANGELOG](../../../CHANGELOG.md).

## Truy vết

| Yêu cầu Ticket-03 | AC | Kiểm chứng | Kết quả |
|---|---|---|---|
| Contract v1.2: 8 khóa mới, thời lượng 240/270/300 | P3-1 | `tools/check-contract.js`, `AC1 idle` (240 → 230) | Đạt |
| Thắp → fuel 100, hao 1/s theo đơn vị 1/60 | P3-2 | `fuel_decay` (99 sau 60 tick, 90 sau 600); M28 | Đạt |
| Hết dầu → `lantern_out`, deposited 0, ever_lit, ánh sáng giảm | P3-3 | `fuel_out` (tick 60); client `ambientIntensity(lit)` | Đạt |
| Châm dầu: used = min(mang, ceil((100−fuel)/10)), tối đa 100, +5; đèn đầy không được chọn | P3-4 | `refuel`, unit "full lanterns are skipped"; M33 | Đạt |
| Thắp lại cần 5, +40, `relight: true`, `relit_count` | P3-5 | `relight`; M31, M34 | Đạt |
| fuel < 30 mất vùng an toàn, đúng 30 giữ | P3-6 | unit 30.02 vs 29.9; M30, M37 | Đạt |
| Bóng wander → đèn yếu gần nhất → `drain` ≤ 2 m, 5/s cộng dồn, `fuel_drain` mỗi 60 tick; không có đèn yếu → đèn tắt gần nhất | P3-7 | `drain` (2 con, event 78/105, tắt tick 187, chuyển sang L2); M29 | Đạt |
| drain → chase (≤ 6 m) / stunned (+15) / wander; châm ≥ 30 đẩy Bóng ra ≤ 30 tick | P3-8 | `drain_exit`, unit pulse +15 & evict; M35, M36, M38 | Đạt |
| Không thắng sớm; bình minh: ≥ ceil(0.6n) → `dawn_survived`, ngược lại `dawn`; hết lửa luôn thua trước | P3-9 | `no_early_win`, `dawn_win`, `dawn_lose`, unit 3/5, 4/6, 5/7; M9, M27 | Đạt |
| Điểm mới + thưởng bình minh Σ(50 + floor(fuel)) + 50 × lửa | P3-10 | `dawn_win` (457), `light_one` (150), `refuel` (40); M39 | Đạt |
| Sức chứa 10 + 2 × lần thắp, tối đa 20; `player.capacity` | P3-11 | unit (16, 20); M32 | Đạt |
| Thanh dầu, nhấp nháy 1 Hz khi < 30, đèn tắt xẹp 20% + rách, HUD mang/sức chứa | P3-12 | Code `sync()` (blink `floor(t·2) % 2`); ảnh `playtest-fuel/`, `playtest/03-night1-play.png` | Đạt (thanh dầu và nhấp nháy chưa có ảnh rõ — xem dưới) |
| Chế độ mù màu (lưu được) | P3-13 | `tests/palette.test.js`; playtest bật cài đặt → ảnh Bóng Mực viền xanh #00B3FF; `settings_persisted` | Đạt |
| Test cũ bị luật mới làm sai: cập nhật/xóa có lý do | DoD | [phase-3.md §1](../../notes/phase-3.md); fixture `win` xóa (thay bằng `no_early_win`) | Đạt |
| Phase 1–2 không bị thay thế vẫn đúng | DoD | Toàn bộ test Phase 1–2 còn lại vẫn xanh; tất định 3 Đêm | Đạt |
| ≥ 30 FPS | — | GPU: 58–60 FPS trung bình | Đạt |

## Chưa đạt / giới hạn (trung thực)

- **Bot playtest chưa thắng được Đêm nào ở Phase 3** (thua vì hết lửa), nên màn kết quả "thắng ở bình minh" và chuỗi sang Đêm 2/3 **chưa** được kiểm chứng bằng client ở phase này. Luật thắng/thua được kiểm chứng bằng scenario headless.
- Ảnh chưa cho thấy rõ thanh dầu và nhịp nhấp nháy 1 Hz (ảnh tĩnh); hành vi nằm trong code `sync()` và chưa có test tự động cho phần hiển thị.
- Tham số debug `?lit=`, `?fuel=`, `?speed=` chỉ dùng để chụp ảnh/playtest, không đổi luật.

## Đánh giá Phase 3

- **Đạt**: toàn bộ luật mới của Ticket-03 có scenario + đột biến; contract v1.2; ADR; changelog breaking changes; test cũ được cập nhật có lý do.
- **Hỏng phase trước?** Không — chỉ những luật được ticket đánh dấu [THAY THẾ] thay đổi; Phase 1–2 còn lại vẫn xanh.
- **Cần chỉnh**: bot playtest cần chiến thuật giữ đèn để chứng minh thắng ở bình minh trong client.
