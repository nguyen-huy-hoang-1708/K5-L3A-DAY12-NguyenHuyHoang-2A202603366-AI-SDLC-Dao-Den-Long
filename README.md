# Đảo Đèn Lồng

> **Video demo:** _chưa có — sẽ quay ở Phase 4 (Release `v1.0.0`)._
> Day 12 · AI SDLC Lab · Nguyễn Huy Hoàng · 2A202603366 · Tài liệu lab gốc: [docs/lab/LAB-README.md](docs/lab/LAB-README.md)

Game 3D góc nhìn thứ ba. Mây — người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng — gom đom đóm trên hòn đảo phủ sương đen để thắp lại **5 Đèn Lồng Lớn** trước khi trời sáng, đồng thời né và xua **Bóng Mực**.

- Trạng thái hiện tại: **Phase 1** (PRD-0 + Test Contract v1.0) — xem [docs/notes/phase-1.md](docs/notes/phase-1.md) và [bằng chứng](docs/proof/phase-1/README.md).
- Công nghệ: JavaScript thuần + Three.js (vendored), Node ≥ 18. **Không cần `npm install`.**

## Cài đặt và chạy (3 lệnh)

```bash
git clone https://github.com/nguyen-huy-hoang-1708/K5-L3A-DAY12-NguyenHuyHoang-2A202603366-AI-SDLC-Dao-Den-Long.git
cd K5-L3A-DAY12-NguyenHuyHoang-2A202603366-AI-SDLC-Dao-Den-Long
node tools/serve.js
```

Trình duyệt tự mở http://localhost:8080/web/ (nếu không, mở tay). Cần trình duyệt có WebGL (Chrome/Firefox/Safari bản mới).

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột, `Q` / `Z` | Xoay camera |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào đèn gần nhất (trong 2.5 m) |
| `F` hoặc `Shift` trái | Tỏa sáng (tốn 2 đom đóm) |
| `R` | Chơi lại sau khi thắng/thua |
| `M` | Tắt/bật âm thanh |

## Luật & cách tính điểm

- Đi vào gần đom đóm (≤ 1 m) để **tự nhặt**; mang tối đa **10**.
- Đứng cạnh đèn (≤ 2.5 m) nhấn `E` để nạp; đủ **5** đom đóm thì đèn sáng.
- Bóng Mực đuổi theo (3.5 m/s, chậm hơn Mây 6 m/s). Bị chạm (≤ 1 m): mất **1 ngọn lửa** (có 3), rơi **một nửa** số đom đóm đang mang (làm tròn xuống), bất tử 2 s.
- **Tỏa sáng**: tốn 2 đom đóm, hồi chiêu 1 s; Bóng Mực trong 6 m bị choáng 3 s và bị đẩy lùi 4 m.
- Bóng Mực **không vào được** vòng 5 m quanh đèn **đã thắp** (vòng sáng vẽ trên đất).
- **Thắng**: thắp đủ 5 đèn. **Thua**: hết lửa, hoặc hết 300 s (trời sáng).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Chế độ headless (Test Contract v1.0)

Khai báo ở [`game.contract.json`](game.contract.json). `build_cmd` = `node --version` (không cần build).

```bash
node headless/run.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

- 60 tick/s cố định, không cần cửa sổ/GPU; một đêm 18000 tick chạy trong ~0.1 s.
- Mã thoát: 0 thành công; 2 file inputs/scenario sai định dạng; 1 lỗi tham số.
- Ghi chú `tuning`: không có trường nào `null`. `fall_enabled: false` vì Mây bị chặn ở mép đảo (không rơi được, không có event `fall`). Thêm trường `island_radius: 40` (bán kính đảo, m) để test biết giới hạn di chuyển. Không có `dash` ở Phase 1 (input `dash` được chấp nhận và bỏ qua).
- Chi tiết thứ tự xử lý trong một tick và các giả định: [docs/notes/phase-1.md](docs/notes/phase-1.md) §2.

## Kiểm chứng

```bash
npm test                      # contract khớp code + 33 test (unit, scenario qua CLI, tất định, mã lỗi)
tools/mutation-check.sh       # cài 10 lỗi cố ý, mọi lỗi phải bị test bắt
node tools/proof.js phase-1   # sinh lại bằng chứng headless vào docs/proof/phase-1/headless/
node tools/playtest.js --mode win --out docs/proof/phase-1/playtest   # chơi client 3D thật bằng Chrome headless
```

CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy test + mutation check + so sánh tất định trên Ubuntu/macOS mỗi lần push.

## Sáng tạo của tôi

Mọi phần sau chỉ nằm ở client (`web/`), **không** đụng luật chơi `src/sim.js`, nên đầu ra headless theo contract không đổi. Không có thực thể nào được thêm vào sim, nên không cần tắt gì khi chạy headless.

**Bằng chứng phần cũ vẫn đúng** — [docs/proof/phase-1/creative-check.txt](docs/proof/phase-1/creative-check.txt), sinh bởi `tools/creative-check.sh`:
- `src/` và `headless/` không import gì từ `web/`; kể từ commit giao diện cũ (tag `ui-classic`), không file nào trong `src/`, `headless/`, `game.contract.json` thay đổi.
- Đầu ra headless **giống hệt từng byte** giữa tag `ui-classic` (giao diện cũ) và bản hiện tại (giao diện tiên hiệp): 12/12 kịch bản trong `tests/scenarios` và 4 đêm đầy đủ 18000 tick (seed 1, 7, 42, 2026).
- `npm test` 33/33 đạt; playtest client thật thắng + thua, 0 lỗi console.


1. **Phong cách tiên hiệp / kiếm hiệp**: đảo nổi giữa biển mây, núi đá dựng đứng trong sương, đảo nhỏ trôi lơ lửng, trăng và sao, bảo tháp, thông, hoa đào rơi, lan can đá đỏ ở mép đảo (chính là giới hạn di chuyển `island_radius`). Hậu kỳ **bloom** làm đèn, đom đóm và hiệu ứng phát sáng.
2. **Đèn Lồng Lớn kiểu cổng gỗ sơn son, đèn giấy đỏ**: khi thắp có **cột sáng lên trời**, tia lửa bung ra; **trận pháp** xoay dưới chân đèn vẽ đúng `safe_radius`; 5 hạt sáng quanh chân đèn cho biết đã nạp bao nhiêu/5.
3. **Quang Chưởng** (tỏa sáng): trận pháp vàng lan đúng `pulse_radius`, sóng xung kích, rung camera. Bóng Mực là khối mực tím đen có vệt khói, khi choáng hiện ấn phù vàng trên đầu.
4. **Mây** mặc áo trắng viền xanh, thắt lưng đỏ, nón lá treo đèn lồng nhỏ, hai dải lụa bay theo gió, vòng khí dưới chân sáng dần theo số đom đóm đang mang.
5. **Đảo sáng dần**: mỗi đèn thắp làm bầu trời chuyển từ tím đen sang ấm, sương lùi xa; thắng thì có pháo hoa.
6. **Âm thanh tự tổng hợp bằng WebAudio** theo **ngũ cung** (không dùng file asset). HUD kiểu bảng sơn mài viền vàng, màn hình tiêu đề có ấn triện.

Ghi chú: rubric không cộng điểm cho đồ họa vượt yêu cầu — phần này làm theo yêu cầu của chủ dự án và chỉ nằm ở client.

Ảnh: [docs/proof/phase-1/playtest/](docs/proof/phase-1/playtest/).

## Cấu trúc

```text
src/sim.js, src/inputs.js   luật chơi tất định (dùng chung headless + web)
headless/run.js             CLI Test Contract
web/                        client 3D (Three.js vendored trong web/vendor)
tests/                      unit + scenario (tests/scenarios/*/scenario.json, inputs.json)
tools/                      serve, proof, playtest, mutation-check, hooks
docs/notes/                 giả định từng phase, nhật ký AI, retro
docs/proof/                 bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/   harness AI (skill verify, hook Stop chặn khi test đỏ)
```

Giấy phép: [LICENSE](LICENSE) (MIT). Nguồn: [CREDITS.md](CREDITS.md).
