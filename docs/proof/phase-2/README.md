# Bằng chứng Phase 2 (tag `phase-2`) — Ticket-02 + Test Contract v1.1

Máy: MacBook Apple M1 Pro, macOS 15.7, Node v24.4.0, Chrome headless. Mọi file ở đây do script sinh ra, **không sửa tay**. Chạy lại ở tag:

```bash
npm test && tools/mutation-check.sh && node tools/proof.js phase-2 && tools/creative-check.sh
node tools/playtest.js --mode campaign --gpu --out docs/proof/phase-2/playtest
node tools/playtest.js --mode lose --gpu --night 2 --out docs/proof/phase-2/playtest-lose-n2
```

| Thư mục / file | Nội dung |
|---|---|
| [headless/README.md](headless/README.md) | 27 fixture (Đêm 1/2/3) + output JSONL, hash tất định 3 Đêm, thời gian một Đêm đầy đủ |
| [headless/test-report.txt](headless/test-report.txt) | `npm test`: contract khớp code + 65 test |
| [mutation-check.txt](mutation-check.txt) | 26 lỗi cố ý, **26/26 bị bắt** |
| [creative-check.txt](creative-check.txt) | Bỏ hẳn `web/` → output headless giống hệt từng byte |
| `playtest/` | Chiến dịch từ menu (GPU, `?lit=4`): pause/cài đặt, Đêm 1 thắng → kết quả → giới thiệu Đêm 2; bot thua Đêm 2 |
| `playtest-night3/` | Bắt đầu ở Đêm 3 (`?night=3&lit=6`): bot không kịp thắp đèn cuối trước bình minh (chưa đạt) |
| `playtest-lose-n1..n3/` | Mỗi Đêm: bot thua → màn kết quả → `R` → chơi lại đúng Đêm đó; ảnh HUD lúc chơi (`playtest-lose-n2/03-night2-play.png`) |

## Truy vết yêu cầu → kiểm chứng → bằng chứng

| Yêu cầu Ticket-02 | AC | Kiểm chứng | Kết quả |
|---|---|---|---|
| Số chuẩn Phần 1 thay mọi số tự chọn; contract v1.1 + 5 khóa mới | P2-1 | `tools/check-contract.js` (trong `npm test`), mutation M10 | Đạt |
| Chạy 6 m/s, tăng tốc ≤ 0.1 s, điều khiển trên không | AC2 | scenario `walk_forward` (60 tick = 6.0 m) | Đạt (tức thì) |
| Nhảy 7 m/s, g −20, chỉ khi chạm đất | P2-3 | unit `jump` (đỉnh ≈ 1.2 m, giữ nút không nhảy lại) | Đạt |
| Lướt 14 m/s × 0.2 s, hồi 1.5 s từ lúc bắt đầu; theo hướng di chuyển/mặt; giữ độ cao trên không | P2-2 | scenario `dash` (event tick 1, 91; 2.8 m), unit air dash; M11, M12 | Đạt |
| Nhặt XZ ≤ 1 m & chênh cao ≤ 1.5 m; sức chứa 10 | AC4/AC5 | scenario `pickup`, unit chênh cao, capacity | Đạt |
| 20 đom đóm ở điểm chuẩn; +1 mỗi 240 tick; trần 30 | P2-5 | scenario `default_spawn` | Đạt |
| Đèn 10, nạp nhiều lần, 2.0 m, gần nhất/id nhỏ | AC6 | `light_one`, unit partial/surplus/nearest; M2 | Đạt |
| Vùng an toàn 6 m; đẩy ra ≤ 30 tick, không sát thương | P2-9 | `safe_zone`, `safe_evict`, unit evict; M1, M21 | Đạt |
| Tỏa Sáng 3/5 m/3 s, tâm chân+0.8 (3D), stun 120, đẩy 4 m/15 tick, +5 kể cả đang choáng | P2-7 | `pulse`, unit cooldown/re-hit/+X; M4, M7 | Đạt |
| Bóng Mực 4.0 (Đêm 3: 4.5), 12/18 m, chạm XZ ≤ 1 & cao ≤ 1.5, 1 hit/tick, recoil 2 m/60 tick; trạng thái đúng tên | P2-8 | `hit`, unit detection, Đêm 3 tốc độ, chênh cao, invuln 2 bóng; M3, M23 | Đạt |
| Lịch sinh 300 + 480k / 420k / 360k, tối đa 6/8/10, ≥ 15 m, id S1… | P2-8 | `default_spawn` (Đêm 1), test lịch Đêm 2/3; M19, M20, M26 | Đạt |
| Bị đánh: −1 lửa, rơi floor(n/2) ra vành 1.5–2.5 m, TTL 480, nhặt lại từ tick sau, bất tử 90 | P2-6 | `hit`, `dropped_ttl`, unit nhặt lại; M8 | Đạt |
| Rơi Y < −10: 1 event `{fall, lost}`, chờ 60, hồi sinh xuất phát, bất tử 90; hết lửa thua ngay | P2-4 | `fall`, `fall_last_flame`; M17, M18 | Đạt |
| Thời gian 300/330/360; thắng/thua sau mỗi tick đúng ưu tiên; điểm chuẩn | P2-16 | `win`, `dawn`, unit ưu tiên no_flames, thắng đúng tick hết giờ; M5, M9 | Đạt |
| Thứ tự xử lý tick bắt buộc | — | Viết đúng 11 bước trong `src/sim.js` `step()`; các scenario chạm/cướp/pulse/spawn kiểm tra hệ quả | Đạt |
| Đêm 2: 2 đảo + cầu, 6 đèn, bục phóng (14, 24) | P2-10 | `n2_pad` (đáp tick 80–90 trong đảo B), map sanity | Đạt |
| Đêm 3: 3 tầng, vách, dốc 30°/150°, bục (12, 8), tháp, 7 đèn | P2-11 | `n3_ramp`, `n3_wall`, `n3_pad`, map sanity; M24, M25 | Đạt |
| Gió mạnh 5 s mỗi 30 s, 2 m/s, báo trước 2 s | P2-12 | `wind` (10.0 m đúng hướng `dir_deg`); client: lá bay + âm thanh + banner | Đạt |
| Gió Lạc: idle/chase/flee/removed, cướp min(3,n) ở 1.2 m, pulse chase → flee, pulse flee → thả | P2-13 | `drifter_steal`, `drifter_pulse_chase`, `drifter_pulse_drop`; M13, M14 | Đạt |
| Bùa Gió: 600 tick, 7.2 m/s, lướt không hồi chiêu, hồi lại sau 2700 | P2-14 | `charm`, unit charm dash/respawn; M15 | Đạt |
| Tạm dừng: tick tăng, sim đứng yên, `state: paused`, event | P2-15 | `pause`; M16 | Đạt |
| Một Đêm 21 600 tick ≤ 30 s | P2-17 | [headless/README.md](headless/README.md): 0.11–0.19 s | Đạt |
| Chuỗi 3 Đêm, menu, giới thiệu (Ông Đăng), kết quả, Bình Minh, chơi lại Đêm thua | P2-18 | `playtest/result-campaign-gpu.json`: menu → Đêm 1 thắng → kết quả → giới thiệu Đêm 2; `playtest-lose-n1..3`: thua → R → chơi lại đúng Đêm | **Đạt một phần** — xem dưới |
| Tạm dừng Esc/P + menu; cài đặt âm lượng, độ nhạy chuột, lưu giữa các lần mở | P2-19 | playtest: `pause` (tick đứng yên), `resumed`, `settings_persisted` sau khi tải lại trang; ảnh `04-pause-menu`, `05-settings` | Đạt |
| HUD đầy đủ, đồng hồ đỏ nhấp nháy ≤ 30 s, nhắc "E — Nạp ánh sáng (x/10)", mũi tên tới đèn ngoài màn hình | P2-20 | ảnh `playtest-lose-n2/03-night2-play.png` (bố cục, mũi tên); code `hud()` | Đạt (đồng hồ đỏ chưa có ảnh) |
| Âm thanh: nhạc nền + 10 loại hiệu ứng | — | tổng hợp WebAudio trong `web/main.js` (`SFX`, `startMusic`) | Đạt (chưa có bằng chứng ghi âm) |
| Bảng màu chuẩn ±10%, ánh sáng môi trường 0.15 + 0.55 × tiến độ | P2-21 | `tests/palette.test.js` | Đạt |
| ≥ 30 FPS trung bình ở 1280×720 | P2-22 | playtest GPU (Metal): trung bình 57.6–58.3 FPS; phần mềm (SwiftShader) chỉ ~9 FPS | Đạt trên GPU |
| Phase 1 vẫn đúng với số chuẩn (regression) | — | Test Phase 1 giữ nguyên ý, sửa số theo ticket ([phase-2.md](../../notes/phase-2.md) §1) | Đạt |
| Sáng tạo không đổi output headless | — | [creative-check.txt](creative-check.txt) | Đạt |

## Chưa đạt / giới hạn đã biết (ghi trung thực)

- **Bot playtest chưa tự thắng được Đêm 2 và Đêm 3** (thua vì Bóng Mực/Gió Lạc, bot chỉ có đường đi thẳng + né đơn giản), nên **màn Bình Minh chưa được kiểm chứng bằng bot**. Chuyển Đêm 1 → kết quả → giới thiệu Đêm 2 đã được kiểm chứng; luật Đêm 2/3 được kiểm chứng bằng scenario headless. Playtest có dùng tham số debug `?lit=K` (thắp sẵn K đèn) và `?speed=4` để rút ngắn — không đổi luật.
- FPS chỉ đạt khi có GPU; Chrome headless chạy phần mềm (SwiftShader) chỉ ~9 FPS. Chưa đo trên máy chấm.
- Chưa có ảnh đồng hồ đỏ (≤ 30 s) và chưa ghi âm thanh làm bằng chứng.
- Camera có thể xuyên qua cây/vách khi đứng sát mép (chỉ ảnh hưởng hiển thị).

## Đánh giá Phase 2

- **Đạt:** toàn bộ Phần 1, 2, 4 (headless, chấm tự động) có scenario + mutation; Phần 3 client đạt trừ phần bot chưa đi hết chiến dịch.
- **Hỏng phase trước?** Không hỏng ý nào; số liệu Phase 1 bị ticket thay — test cũ đã sửa số, không tắt test nào; test "kept on island" được thay bằng `fall` (luật đổi, có ghi lý do).
- **Cần chỉnh:** bot playtest có tìm đường và né tốt hơn để chứng minh Bình Minh; ghi lại số đo FPS trên máy khác.
