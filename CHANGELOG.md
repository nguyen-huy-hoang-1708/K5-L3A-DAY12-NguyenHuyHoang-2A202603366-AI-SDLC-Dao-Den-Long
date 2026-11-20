# Changelog

## v1.0.0 / phase-4 — Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3
- **Contract v1.3**: thêm `bench_cmd` (`node tools/bench.js`) và `soak_cmd` (`node --jitless --expose-gc headless/soak.js`). Luật và số liệu không đổi: đầu ra headless giống hệt tag `phase-3`.
- **Benchmark**:
  - Cảnh chuẩn gồm 200 Bóng Mực, 100 đom đóm và đèn L1–L3 sáng; camera bay vòng. Chạy trong cửa sổ Chrome 1280×720, vsync tắt.
  - Kết quả ghi ra `bench.json`. Sim có thêm chế độ `bench`: không sinh thêm thực thể, không sát thương, không nhặt, không hao dầu, không kết thúc Đêm.
- **Soak**: 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed, kết quả ghi ra `soak.json`.
- **Bảng xếp hạng cục bộ**:
  - Nhập tên sau màn Bình Minh hoặc sau khi thua (hỗ trợ tiếng Việt). Giữ top 10, lưu ra đĩa qua API của `tools/serve.js`.
  - Có màn hình bảng xếp hạng từ menu và lệnh `--export-leaderboard`.
- **Dễ tiếp cận**:
  - Đổi phím cho 9 hành động, có báo trùng và khôi phục mặc định.
  - Phụ đề cho Bóng Mực xuất hiện (kèm mũi tên chỉ hướng), gió, 10 s cuối và đèn yếu.
  - Tùy chọn giảm chuyển động; chữ ≥ 18 px và tùy chọn chữ lớn ×1.25.
  - ⚠ Phím lướt `Q` dự phòng bị bỏ; phím mặc định là `Shift` trái và đổi được.
- **Phát hành**:
  - `npm run dist` tạo `dist/dao-den-long-v1.0.0-web.zip` (bản web tĩnh + server).
  - Video `docs/demo/demo.mp4` được quay từ game chạy thật (`tools/make-demo.js`).
  - README đầy đủ, có ảnh minh họa.
- Test: 89 test và 41 đột biến. Có thêm test cho bench, soak, bảng xếp hạng, đổi phím và cỡ chữ.

## phase-3 — Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md).

### ⚠ Breaking changes
- **Luật thắng**: bỏ thắng sớm. `game_over.reason` **không còn `all_lit`**. Thắng chỉ xét lúc bình minh (`dawn_survived`), khi số đèn đang sáng ≥ ceil(0.6 × tổng). Thua là `dawn` hoặc `no_flames`.
- **Thời lượng Đêm**: 300/330/360 s → **240/270/300 s** (`night*_duration_s`).
- **Đèn có nhiên liệu**: đèn sáng có thể tắt (event mới `lantern_out`). Đèn đã sáng giờ **nhận** đom đóm để châm dầu (event mới `refuel`). Thắp lại chỉ cần 5 đom đóm.
- **Vùng an toàn**: đèn có fuel < 30 mất vùng an toàn.
- **Bóng Mực**:
  - Thêm trạng thái `drain` và event `fuel_drain`.
  - Bóng `wander` đi tới đèn yếu, nếu không có thì tới đèn tắt gần nhất, với tốc độ của Bóng. Trước đây Bóng `wander` lượn 1.5 m/s tới điểm ngẫu nhiên.
- **Công thức điểm**: +5 cho mỗi đom đóm nạp vào đèn (trước là +10); +100 khi thắp lần đầu; +40 khi thắp lại; +15 khi Tỏa Sáng trúng Bóng đang hút. Thưởng bình minh: 50 + floor(fuel) cho mỗi đèn sáng và 50 cho mỗi lửa. **Bỏ thưởng thời gian** (`per_second_left: 0`).
- **Sức chứa**: không còn cố định 10, mà bằng 10 + 2 × số lần thắp thành công, tối đa 20.
- **Contract v1.2**:
  - `tuning` thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.
  - Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`. Snapshot `player` thêm `capacity`.
  - `lantern_lit` thêm `relight`.
  - Scenario thêm `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.

### Khác
- Client:
  - Thêm thanh dầu, đèn nhấp nháy 1 Hz khi fuel < 30, đèn tắt bị xẹp 20% và có vết rách, tia mực khi Bóng hút dầu.
  - HUD hiện đang mang/sức chứa và số đèn cần giữ.
  - Thêm cài đặt **Bảng màu dễ phân biệt** (được lưu): viền và mắt Bóng #00B3FF, cảnh báo UI #FFFFFF kèm ⚠.
- Test:
  - Test cũ bị luật mới làm sai được viết lại, kèm lý do trong [docs/notes/phase-3.md](docs/notes/phase-3.md) §1. Fixture `win` được thay bằng `no_early_win`.
  - Có 77 test, 36 fixture và 39 đột biến.

## phase-2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1
- Số chuẩn thay mọi số tự chọn của Phase 1 (`game.contract.json` v1.1 + 5 khóa mới); bản đồ chuẩn 3 Đêm (`src/maps.js`).
- Luật mới: lướt, nhảy chuẩn, rơi khỏi đảo + hồi sinh, đom đóm rơi có TTL, trạng thái Bóng Mực (spawning/wander/chase/recoil/stunned), đẩy ra khỏi vùng an toàn, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng; thứ tự 11 bước mỗi tick.
- Client: chuỗi 3 Đêm (menu, giới thiệu Ông Đăng, kết quả, Bình Minh), tạm dừng + cài đặt lưu localStorage, HUD theo bố cục ticket, mũi tên tới đèn, bảng màu chuẩn, nhạc nền + hiệu ứng âm thanh.
- 65 test (27 scenario), 26 mutation, creative-check mới (bỏ `web/`), playtest chiến dịch + đo FPS GPU.

## Giao diện tiên hiệp (sau tag phase-1, chỉ client)
- Viết lại `web/main.js` + `web/index.html`: đảo nổi giữa biển mây, núi trong sương, bloom, đèn lồng giấy đỏ + cột sáng, trận pháp, Quang Chưởng, Bóng Mực mực tím, hoa đào, pháo hoa thắng, HUD sơn mài viền vàng.
- `src/`, `headless/`, `game.contract.json` không đổi → đầu ra headless không đổi (33/33 test).

## phase-1 — PRD-0 + Test Contract v1.0
- Luật chơi tất định `src/sim.js` (nhặt đom đóm, nạp/thắp đèn, Bóng Mực đuổi, tỏa sáng, vùng an toàn, thắng/thua, điểm).
- CLI headless `headless/run.js` theo Test Contract v1.0; `game.contract.json`.
- Client 3D Three.js `web/` với HUD, chơi lại, âm thanh tự tổng hợp.
- 33 test (unit, scenario qua CLI, tất định, mã lỗi), mutation check, playtest client thật, CI.
- Harness: AGENTS.md, skill `verify`, hook Stop chặn khi test đỏ.
