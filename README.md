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

Mọi phần sau chỉ nằm ở client (`web/main.js`), **không** đụng `src/sim.js`, nên đầu ra headless không đổi (bằng chứng: `npm test` + hash tất định trong [docs/proof/phase-1/headless/README.md](docs/proof/phase-1/headless/README.md) không phụ thuộc thư mục `web/`).

1. **Âm thanh tự tổng hợp bằng WebAudio** (không dùng file asset): tiếng "ting" khi nhặt đom đóm, hợp âm đi lên khi thắp đèn, âm trầm khi bị chạm, giai điệu thắng/thua.
2. **Đảo sáng dần**: mỗi đèn thắp làm bầu trời/sương chuyển từ tím đen sang tím hồng ấm và sương lùi xa hơn; đèn của Mây sáng mạnh hơn khi mang nhiều đom đóm.
3. **Vòng tiến độ dưới chân đèn** cho biết đã nạp bao nhiêu/5, và **vòng an toàn** phát sáng quanh đèn đã thắp (đúng `safe_radius`).

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
