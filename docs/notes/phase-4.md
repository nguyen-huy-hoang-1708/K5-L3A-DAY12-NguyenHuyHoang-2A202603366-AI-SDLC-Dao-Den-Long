# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" + Test Contract v1.3

Ticket-04 không đổi luật chơi. Mọi yêu cầu của v1.0–v1.2 được giữ; toàn bộ test Phase 1–3 vẫn chạy.

## 1. Giả định

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| D1 | Bench cho bản web: "mở cửa sổ 1280×720" | `node tools/bench.js` mở **Chrome có cửa sổ thật** (`--app`) và chỉnh kích thước để vùng vẽ đúng 1280×720. Tắt vsync bằng `--disable-gpu-vsync --disable-frame-rate-limit`. Có cờ `--headless` để chạy trong CI; kết quả ghi rõ chế độ nào. |
| D2 | `load_ms` | Tính từ lúc tiến trình `bench.js` bắt đầu (đồng hồ hệ thống) tới khung hình đầu tiên của cảnh bench (`Date.now()` trong trang, cùng máy). Gồm thời gian khởi động Chrome và server. |
| D3 | `peak_mem_mb` cho bản web | Lấy mẫu `ps` mỗi 250 ms trong lúc đo; ghi **tổng RSS của mọi tiến trình Chrome** dùng profile bench (browser, GPU, renderer) cộng với server Node. Không dùng `null`, vì đo được ở mức tiến trình hệ điều hành. |
| D4 | Bóng Mực trong bench "đi theo luật wander bình thường" | Dùng đúng AI của sim, kể cả việc phát hiện Mây trong 12 m (khi đó Bóng chuyển `chase` nhưng không gây sát thương). Cảnh bench tắt: sinh thêm, sát thương, nhặt, hao dầu (kể cả hút dầu), kết thúc Đêm. Bật bằng `createGame({ bench: true })`; chế độ thường không đổi (creative-check chứng minh). |
| D5 | "Rải đều trên đảo (seed 42)" | Lấy mẫu đều theo diện tích trong đĩa bán kính 38 m bằng `mulberry32(42)`, cho 200 Bóng (tâm cao 1.0 m) và 100 đom đóm. Hàm `benchScenario(seed)` nằm trong `src/bench.js`. |
| D6 | Hiệu ứng sáng tạo trong bench | Tắt: hoa đào, lá gió, cây, đá, bảo tháp, núi xa, tia lửa, pháo hoa, rung camera. Giữ các thứ thuộc "hiệu ứng và ánh sáng như lúc chơi thật": bloom, đèn điểm, sương, bầu trời, biển mây, thanh dầu, vòng an toàn. |
| D7 | Soak: "Đêm thứ i dùng seed 7 + i" | i đếm từ 0, nên Đêm đầu dùng seed 7 = `--seed`. Đêm i là Đêm `(i mod 3) + 1`. Dùng một RNG riêng cho input (`mulberry32(seed)` của Đêm đó). Hướng di chuyển là góc ngẫu nhiên, đổi mỗi 30 tick. Nút bấm theo xác suất mỗi tick (5%/3%/2%/10%); cạnh lên xảy ra khi tick trước không bấm. |
| D8 | Soak: đo bộ nhớ | `node --expose-gc headless/soak.js`. Gọi `gc()` trước khi đo `mem_start_mb` (sau khi tải Đêm đầu) và `mem_end_mb` (sau khi bỏ tham chiếu Đêm cuối). Nếu không có `gc` thì vẫn chạy, chỉ là không gọi. |
| D9 | Lưu bảng xếp hạng "trên đĩa cục bộ" + lệnh xuất | Server `tools/serve.js` lưu vào `data/leaderboard.json` (đường dẫn đổi được bằng `DDL_DATA`), và client gọi `/api/leaderboard`. `node tools/serve.js --export-leaderboard out.json` đọc file đó. Nếu mở bản web tĩnh không có server, client dùng `localStorage` làm dự phòng. |
| D10 | Tên | NFC hóa, rồi kiểm tra `^[\p{L}\p{M}\p{N}_]{3,12}$` (cho phép tiếng Việt có dấu, là điểm cộng). Độ dài đếm theo ký tự sau NFC. |
| D11 | `achieved_at` | ISO 8601 theo múi giờ máy, ví dụ `2026-11-20T15:04:05+07:00`. Bằng điểm thì ai có `achieved_at` sớm hơn đứng trên; nếu trùng nữa thì ai được thêm trước đứng trên. |
| D12 | `seed` trong bảng xếp hạng | Seed của Đêm 1 trong lượt chơi. Đêm n dùng seed + n − 1. |
| D13 | Chữ tối thiểu 18 px | Mọi chữ UI (HUD, menu, phụ đề) có `font-size` ≥ 18 px ở 1280×720. Tùy chọn chữ lớn nhân 1.25 (`html.big`). |

## 2. Tiêu chí nghiệm thu

| ID | Tiêu chí | Kiểm chứng |
|---|---|---|
| P4-1 | `bench_cmd` tạo `bench.json` đủ 10 trường, tự thoát mã 0 sau 3 s + `--duration` | `tools/bench.js`, file `bench.json` đã commit |
| P4-2 | Cảnh bench đúng: 200 Bóng wander, 100 đom đóm, L1–L3 sáng fuel 100; không sinh thêm, không sát thương, không nhặt, không hao dầu, không kết thúc | `tests/bench.test.js` (headless, 60 s mô phỏng) |
| P4-3 | Công thức avg_fps, p1_low_fps, frame_ms_p95 đúng định nghĩa | `tests/bench.test.js` (hàm `benchStats` với dữ liệu biết trước) |
| P4-4 | Camera bench: bán kính 30, Y = 15, xuất phát (30, 15, 0), ngược chiều kim đồng hồ, 15 s/vòng | unit `benchCamera(t)` |
| P4-5 | Soak 10 Đêm: crashes 0, mem_end ≤ 1.2 × mem_start | `soak.json` đã commit, `tests/soak.test.js` (chạy 3 Đêm ngắn) |
| P4-6 | Bảng xếp hạng: kiểm tra tên, top 10, sắp xếp, lưu đĩa, xuất đúng thứ tự | `tests/leaderboard.test.js` (gồm test server API + `--export-leaderboard`) |
| P4-7 | Đổi phím 9 hành động, báo trùng, khôi phục mặc định, được lưu | `tests/keymap.test.js` + playtest |
| P4-8 | Phụ đề/chỉ báo: Bóng xuất hiện (+ mũi tên), gió, 10 s cuối, đèn < 30 | playtest đọc `#captions` |
| P4-9 | Giảm chuyển động: không rung camera, không chớp màn hình | code + playtest (setting) |
| P4-10 | Chữ ≥ 18 px; chữ lớn ×1.25 | `tests/a11y.test.js` quét CSS/inline |
| P4-11 | Contract v1.3 có `bench_cmd`, `soak_cmd` | `tools/check-contract.js` |
| P4-12 | Clone sạch, 3 lệnh, chơi được; Release có bản web tĩnh | clone kiểm tra + `npm run dist` |
