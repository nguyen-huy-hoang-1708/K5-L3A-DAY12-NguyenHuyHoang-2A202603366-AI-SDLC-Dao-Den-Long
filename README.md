# Đảo Đèn Lồng

> **Video demo:** _chưa có — sẽ quay ở Phase 4 (Release `v1.0.0`)._
> Day 12 · AI SDLC Lab · Nguyễn Huy Hoàng · 2A202603366 · Tài liệu lab gốc: [docs/lab/LAB-README.md](docs/lab/LAB-README.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng, đi qua **ba đêm trên ba hòn đảo** giữa biển mây. Mây gom đom đóm để thắp lại các Đèn Lồng Lớn trước bình minh, đồng thời né và xua **Bóng Mực** và **Gió Lạc**.

- Trạng thái: **Phase 2** (Ticket-02 + Test Contract v1.1). Giả định và tiêu chí nghiệm thu: [phase-1](docs/notes/phase-1.md), [phase-2](docs/notes/phase-2.md). Bằng chứng: [phase-1](docs/proof/phase-1/README.md), [phase-2](docs/proof/phase-2/README.md).
- Công nghệ: JavaScript thuần + Three.js (đặt sẵn trong repo), Node ≥ 18. **Không cần `npm install`.**

## Cài đặt và chạy (3 lệnh)

```bash
git clone https://github.com/nguyen-huy-hoang-1708/K5-L3A-DAY12-NguyenHuyHoang-2A202603366-AI-SDLC-Dao-Den-Long.git
cd K5-L3A-DAY12-NguyenHuyHoang-2A202603366-AI-SDLC-Dao-Den-Long
node tools/serve.js
```

Trình duyệt tự mở http://localhost:8080/web/ (nếu không, mở tay). Cần trình duyệt có WebGL. Nên chạy trên máy có GPU để đạt ≥ 30 FPS.

## Điều khiển

| Phím | Hành động |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển (theo hướng camera, điều khiển được cả trên không) |
| Kéo chuột | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| `Space` | Nhảy |
| `Shift` hoặc `Q` | Lướt |
| `E` | Nạp đom đóm vào đèn gần nhất (trong 2 m) |
| `F` | Tỏa Sáng |
| `Esc` / `P` | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| `Enter` | Chọn nút chính trên các màn hình · `R` chơi lại Đêm vừa thua · `M` tắt/bật âm |

## Ba Đêm

Menu chính → giới thiệu Đêm (tên đảo, lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì hiện màn Bình Minh với tổng điểm. Thua thì chơi lại chính Đêm đó.

| Đêm | Đảo | Thời gian | Đèn | Đặc điểm |
|---|---|---|---|---|
| 1 | Đảo Bến | 300 s | 5 | Đảo tròn bán kính 40 m |
| 2 | Đảo Cau | 330 s | 6 | Hai đảo nối bằng cầu tre không lan can, bục phóng bay sang đảo kia, có Gió Lạc và Bùa Gió |
| 3 | Đảo Chuông | 360 s | 7 | 3 tầng, dốc, bục phóng lên tháp chuông, gió mạnh 5 s mỗi 30 s, Bóng Mực nhanh hơn |

## Luật và điểm (số chuẩn Ticket-02)

- Tự nhặt đom đóm khi ở gần (≤ 1 m, chênh cao ≤ 1.5 m), mang tối đa **10**. Mỗi đèn cần **10** đom đóm và được nạp nhiều lần.
- **Tỏa Sáng**: tốn 3 đom đóm, hồi chiêu 3 s. Bóng Mực trong bán kính 5 m bị choáng 2 s và bị đẩy lùi 4 m. Gió Lạc đang đuổi thì bỏ chạy; Gió Lạc đang chạy mà mang đom đóm cướp được thì thả lại.
- **Lướt**: 14 m/s trong 0.2 s, hồi chiêu 1.5 s.
- **Bùa Gió**: trong 10 s chạy 7.2 m/s và lướt không có hồi chiêu.
- Bị Bóng Mực chạm: mất 1 Ngọn Lửa (có 3), rơi một nửa số đom đóm ra xung quanh (nhặt lại được trong 8 s), bất tử 1.5 s.
- Rơi khỏi đảo: mất 1 Ngọn Lửa và toàn bộ đom đóm, hồi sinh ở điểm xuất phát sau 1 s.
- Bóng Mực không vào được vùng 6 m quanh đèn đã sáng. Gió Lạc không bị vùng này chặn và chỉ cướp đom đóm, không làm mất lửa.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp một đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (kể cả con đang choáng) | +5 |
| Khi thắng Đêm: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng Đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm của các Đêm đã thắng.

## Chế độ headless (Test Contract v1.1)

Khai báo ở [`game.contract.json`](game.contract.json). `build_cmd` là `node --version` (không cần build).

```bash
node headless/run.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

- `--night` nhận 1, 2 hoặc 3. Logic chạy cố định 60 tick/s. Một Đêm đầy đủ (21 600 tick) chạy khoảng 0.2 s.
- Mã thoát: 0 nếu thành công; 2 nếu file inputs/scenario sai định dạng; 1 nếu tham số sai.
- `tuning` khớp số chuẩn và không có trường `null`. `fall_enabled: true`.
- Trường thêm (không thay trường bắt buộc):
  - `player`: `invuln_s`, `facing_deg`, `respawn_s`. `player.invuln` là boolean.
  - `shades[]`: `ticks_left`. `charms[]`: `pos`.
- Scenario nhận thêm `state_ticks_left` cho `drifters[]`, và `charms[].respawn_ticks`. `motes[]` nhận `[x,y,z]` hoặc `{pos, kind, ttl_ticks}`.
- Những chỗ ticket chưa nói rõ (điểm xuất phát Đêm 3, vách, lướt trên bục phóng, …) đã được giả định và ghi trong [docs/notes/phase-2.md](docs/notes/phase-2.md) §2.

## Kiểm chứng

```bash
npm test                       # contract khớp code + 65 test (unit, 27 scenario qua CLI, 3 Đêm, tất định, bảng màu)
tools/mutation-check.sh        # 26 lỗi cố ý, mọi lỗi phải bị test bắt
node tools/proof.js phase-2    # sinh lại bằng chứng headless
tools/creative-check.sh        # xoá web/ → output headless phải giống hệt
node tools/playtest.js --mode campaign --gpu   # chơi client 3D thật (Chrome headless), đo FPS 1280×720
```

CI: [.github/workflows/ci.yml](.github/workflows/ci.yml) chạy test, mutation check, creative check và so sánh tất định trên Ubuntu/macOS mỗi lần push.

## Sáng tạo của tôi

Mọi phần sau chỉ nằm ở client (`web/`), không đụng luật chơi (`src/`), nên đầu ra headless không đổi. Các thành phần ticket quy định màu đều lấy màu từ bảng màu chuẩn ([web/palette.js](web/palette.js)).

1. **Phong cách tiên hiệp**: đảo nổi giữa biển mây, núi đá trong sương, trăng và sao, bảo tháp, thông, hoa đào rơi. Hiệu ứng **bloom** làm ánh sáng phát quang.
2. **Đèn Lồng Lớn kiểu cổng gỗ**: khi thắp có cột sáng lên trời. Dưới chân đèn có **trận pháp xoay**, vẽ đúng bán kính vùng an toàn 6 m. Quanh chân đèn có 10 hạt sáng cho biết đã nạp bao nhiêu.
3. **Hình ảnh các thực thể**:
   - Tỏa Sáng: trận pháp vàng lan ra đúng bán kính 5 m.
   - Bóng Mực bị choáng: hiện ấn phù trên đầu.
   - Gió Lạc: dải lụa uốn lượn, có đom đóm cướp được bay quanh.
   - Bùa Gió: lá bùa đỏ viền vàng, vẽ bằng code.
4. **Ông Đăng**, nhân vật dẫn chuyện mới: mỗi Đêm có một lời dặn riêng, và có lời chúc ở màn Bình Minh.
5. **Âm thanh tự tạo bằng code** (không dùng file):
   - Nhạc nền theo thang ngũ cung.
   - Hiệu ứng cho nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, bùa, Gió Lạc cướp, thắng, thua, Bóng Mực xuất hiện, gió và đếm ngược 10 s cuối.

**Bằng chứng phần cũ vẫn đúng**: [docs/proof/phase-2/creative-check.txt](docs/proof/phase-2/creative-check.txt). `src/` và `headless/` không import gì từ `web/`. Chạy bản sao **không có thư mục `web/`** cho đầu ra giống hệt từng byte ở 27 scenario và một Đêm đầy đủ của cả 3 bản đồ.

## Cấu trúc

```text
src/sim.js, src/maps.js, src/inputs.js   luật chơi tất định + bản đồ chuẩn (dùng chung headless + web)
headless/run.js                          CLI Test Contract v1.1
web/                                     client 3D (main.js, world.js, palette.js; Three.js trong web/vendor)
tests/                                   unit + scenario (tests/scenarios/*/scenario.json, inputs.json, meta.json)
tools/                                   serve, proof, playtest, mutation-check, creative-check, hooks
docs/notes/  docs/proof/                 giả định, nhật ký AI, retro · bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/           harness AI (skill verify, hook Stop chặn khi test đỏ)
```

Giấy phép: [LICENSE](LICENSE) (MIT). Nguồn: [CREDITS.md](CREDITS.md).
