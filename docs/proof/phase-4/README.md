# Bằng chứng Phase 4 (tag `phase-4`, Release `v1.0.0`) — Ticket-04 + Test Contract v1.3

Máy: MacBook Apple M1 Pro, 32 GB, macOS 15.7, Node v24.4.0, Chrome 157 (GPU Metal). Số tự đo chỉ để tham khảo; máy chấm do giảng viên công bố.

```bash
node tools/bench.js --seed 42 --duration 30 --out bench.json                       # cửa sổ Chrome thật 1280×720
node --jitless --expose-gc headless/soak.js --seed 7 --nights 10 --out soak.json
npm test && tools/mutation-check.sh && node tools/proof.js phase-4 && tools/creative-check.sh
node tools/playtest.js --mode campaign --gpu --lit 5 --out docs/proof/phase-4/playtest
node tools/playtest.js --mode lose --gpu --out docs/proof/phase-4/playtest-lose
node tools/make-demo.js && npm run dist
```

## Kết quả đo

| Yêu cầu | Ngưỡng | Kết quả tự đo | File |
|---|---|---|---|
| avg_fps | ≥ 60 | **236.8** | [bench.json](../../../bench.json) |
| p1_low_fps | ≥ 30 | **145.7** | 〃 |
| load_ms | ≤ 10000 | **2164** | 〃 (tính cả khởi động Chrome và server) |
| frame_ms_p95 / frames / peak_mem_mb | — | 5.2 ms / 7104 / 1210 MB (tổng tiến trình Chrome + server) | 〃 |
| Soak crashes | = 0 | **0** (10 Đêm: 1→2→3 xoay vòng) | [soak.json](../../../soak.json) |
| Soak mem_end ≤ 1.2 × mem_start | ≤ 1.2 | **41.7 → 43.9 MB (×1.05)** với `--jitless`; khi bật JIT ×1.66, nhưng heap JS đứng yên (3.8 → 4.3 MB) | [soak-with-jit.json](soak-with-jit.json) |
| Headless một Đêm | ≤ 30 s | 0.12–0.22 s | [headless/README.md](headless/README.md) |

## Truy vết

| Yêu cầu Ticket-04 | AC | Kiểm chứng | Kết quả |
|---|---|---|---|
| bench_cmd + bench.json đủ trường, thoát mã 0 | P4-1 | chạy thật ở trên; `contract_version: "1.3"` | Đạt |
| Cảnh bench chuẩn: 200 Bóng wander, 100 đom đóm, L1–L3 fuel 100; tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm | P4-2 | `tests/bench.test.js` (300 s mô phỏng: 0 event, đủ 200/100, dầu 100); M40, M41 | Đạt |
| Định nghĩa avg / p1 low / p95 | P4-3 | `tests/bench.test.js` với dữ liệu biết trước | Đạt |
| Camera bay vòng r 30, Y 15, bắt đầu (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng; 3 s khởi động | P4-4 | unit `benchCamera`; `BENCH.WARMUP_S = 3` | Đạt |
| Cửa sổ 1280×720, vsync tắt | P4-1 | `bench.json.window = "window, drawable 1280x720"`, cờ Chrome; avg 236 fps chứng tỏ không bị giới hạn ở 60 | Đạt |
| Hiệu ứng sáng tạo tắt khi bench | — | `buildNight/buildSky({bench})`, petals/leaves ẩn; ảnh [bench-scene.jpg](../../media/bench-scene.jpg) | Đạt |
| Soak 10 Đêm, seed 7 + i, input ngẫu nhiên đúng xác suất | P4-5 | `headless/soak.js`, `tests/bench.test.js` (3 Đêm), soak.json | Đạt (dùng `--jitless`, có giải thích) |
| Bảng xếp hạng: tên 3–12, tiếng Việt, top 10, sắp xếp, ISO 8601 có múi giờ, lưu đĩa, màn hình từ menu, `--export-leaderboard` | P4-6 | `tests/leaderboard.test.js` (gồm khởi động lại server); playtest `lb_invalid_rejected`, `lb_screen`, `lb_export` ([leaderboard-export.json](playtest-lose/leaderboard-export.json)) | Đạt |
| Đổi phím 9 hành động, báo trùng, khôi phục mặc định, được lưu | P4-7 | `tests/keymap.test.js`; playtest `remap`, `remap_duplicate_warning` (ảnh `05b-keys-duplicate`), `remap_reset`, `settings_persisted` | Đạt |
| Phụ đề/chỉ báo: Bóng Mực + mũi tên, gió, 10 s cuối, đèn < 30 | P4-8 | playtest `captions` (ảnh `03b-…-caption-shade`); code `caption()`, `edgeArrow()` | Đạt (Bóng Mực có ảnh; 3 loại còn lại mới được xem trong code) |
| Giảm chuyển động | P4-9 | `settings.reduceMotion` → không rung camera; `body.rm` tắt chớp màn hình | Đạt (chưa có test tự động) |
| Chữ ≥ 18 px, chữ lớn ×1.25 | P4-10 | `tests/keymap.test.js` quét CSS và inline | Đạt |
| Contract v1.3 | P4-11 | `tools/check-contract.js` | Đạt |
| Clone sạch, 3 lệnh, chơi được; Release có bản web tĩnh | P4-12 | clone sạch + giải nén `dist/dao-den-long-v1.0.0-web.zip`: headless, server, API chạy | Đạt (Release trên GitHub do chủ repo tạo) |
| README, CHANGELOG 4 phase, CREDITS, LICENSE, retro, video < 5 phút | — | [README](../../../README.md), [CHANGELOG](../../../CHANGELOG.md), [retro](../../notes/retro.md), [demo.mp4](../../demo/demo.mp4) (2:50) | Đạt |
| Test ẩn Phase 1–3 vẫn đạt | DoD | [headless-vs-phase-3.txt](headless-vs-phase-3.txt): 38/38 giống hệt từng byte | Đạt |

## Chưa đạt / giới hạn (trung thực)

- **Bot vẫn chưa tự thắng được Đêm nào**, nên màn Bình Minh → nhập tên chưa được bot chạy hết. Phần nhập tên và lưu điểm đã được kiểm chứng qua đường "thua → nhập tên", và các hàm dùng chung đã có unit test.
- Soak đạt nhờ `--jitless`. Khi chạy Node bình thường, RSS ×1.66 vì bộ nhớ của trình biên dịch V8, dù heap JS phẳng. Đã ghi rõ lý do và lưu số đo.
- `peak_mem_mb` của bản web là tổng RSS của mọi tiến trình Chrome, nên cao hơn một engine native.
- Chưa có test tự động cho chế độ giảm chuyển động, phụ đề gió, 10 s cuối và đèn yếu.
- Video chụp khoảng 10 khung hình mỗi giây. Phần chơi đôi khi trông nhanh hơn thực tế vì nhịp chụp, nhưng không có tham số tăng tốc nào được bật.
