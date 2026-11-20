# Phase 1 — PRD-0 + Test Contract v1.0

Nguồn yêu cầu: tab Phase 1 trên lab board (PRD-0, Test Contract v1.0). Chỉ Phase 1 đã phát hành tại thời điểm làm.

## 1. Quyết định kiến trúc (một dòng lý do mỗi cái)

| Quyết định | Lý do |
|---|---|
| JavaScript thuần, không dependency npm | Một module logic `src/sim.js` chạy được cả trong Node (headless) lẫn trình duyệt (game 3D) → đầu ra headless và game thật là **cùng một code**. Không cần `npm install`. |
| Three.js 0.160 (MIT) vendored trong `web/vendor/` | Chạy offline, không phụ thuộc CDN khi chấm. |
| `src/sim.js` không đụng `Math.random`, `Date`, DOM | Đảm bảo tính tất định; RNG `mulberry32(seed)`. |
| Server tĩnh tự viết `tools/serve.js` (Node built-in) | `run_cmd` chỉ 1 lệnh, không cần cài gì. |

## 2. Giả định cho chỗ mơ hồ

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A1 | "Máu" là gì | `flames` = số ngọn lửa của Mây, mặc định 3. Mỗi lần bị chạm −1. Về 0 → thua `no_flames`. |
| A2 | Nhặt đom đóm | **Tự động** khi đi vào `pickup_radius` (≤ 1.0 m) và `carried < carry_capacity` (10). Đầy túi thì đom đóm vẫn nằm đó. Mỗi con nhặt → 1 event `mote_picked`, +`per_mote` điểm. Nhiều con cùng tick xử lý theo thứ tự id. |
| A3 | Nạp đèn | Nhấn `interact` (cạnh lên) trong `interact_radius` (≤ 2.5 m) của một đèn **chưa thắp** → nạp `min(carried, lantern_cost − deposited)`. Nhiều đèn trong tầm → đèn gần nhất (hoà thì id nhỏ hơn). Nạp 0 con → không có event. Đủ `lantern_cost` (5) → `lantern_lit`, +`per_lantern`. |
| A4 | Tỏa sáng "tốn ánh sáng" | Pulse tốn `pulse_cost` = 2 đom đóm đang mang. Thiếu đom đóm hoặc đang hồi chiêu (`pulse_cooldown_s` = 1 s) → không có gì xảy ra, không event. Pulse thành công luôn ghi event `pulse` (kể cả `stunned_ids` rỗng). |
| A5 | Hiệu ứng pulse | Mọi Bóng Mực trong `pulse_radius` (≤ 6 m) → `stunned` trong `pulse_stun_s` (3 s), bị đẩy ra xa người chơi `pulse_push_m` (4 m) theo phương ngang ngay lập tức, +`per_stun` mỗi con. Con đang stunned bị pulse lại → làm mới thời gian stun và vẫn được tính. Bóng Mực đứng đúng vị trí người chơi → đẩy theo +X. |
| A6 | "Bóng Mực sợ đèn" | Chỉ đèn **đã thắp** tạo vùng an toàn `safe_radius` (5 m). Sau khi di chuyển, nếu Bóng Mực ở trong vùng (khoảng cách < 5) thì bị đặt lại ra đúng biên (khoảng cách = 5). Đèn chưa thắp không có tác dụng. |
| A7 | Bị chạm | Bóng Mực ở trạng thái `chase`, khoảng cách ngang ≤ `shade_hit_radius` (1.0 m), người chơi không trong thời gian bất tử → −1 flame, đánh rơi `floor(carried × hit_drop_ratio)` đom đóm (ratio 0.5), bất tử `invuln_s` (2 s). Đom đóm đánh rơi **mất luôn** (không sinh lại trên đất). Một tick chỉ bị trúng tối đa 1 lần. |
| A8 | Đảo tròn, rơi khỏi đảo | Đảo bán kính 40 m (`tuning.island_radius`, trường bổ sung). Người chơi bị chặn ở mép → `fall_enabled: false`, không có event `player_hit` `by: "fall"`. Bóng Mực cũng bị chặn ở mép. |
| A9 | Nhảy | Vận tốc nhảy 7 m/s, trọng lực 22 m/s² (≈ 1.1 m cao, ≈ 0.64 s). Chỉ nhảy khi chạm đất. Nhảy **không** ảnh hưởng nhặt/chạm (mọi khoảng cách đo trên XZ theo contract). |
| A10 | Di chuyển | Vận tốc tức thời `player_speed` (6 m/s) × vector move (đã chuẩn hoá nếu > 1, xoay theo `cam_yaw_deg` đúng công thức contract). Không có quán tính. Không có `dash` ở Phase 1 (input `dash` được chấp nhận và bỏ qua). |
| A11 | Bóng Mực đuổi | Trạng thái `chase`: đi thẳng về phía người chơi trên XZ với `shade_speed` (3.5 m/s), giữ nguyên độ cao Y. Không dừng khi người chơi bất tử. |
| A12 | Sinh Bóng Mực | Mặc định (random_shades true): bắt đầu với 2 con S1, S2 ở mép đảo (vị trí theo seed, cách người chơi ≥ 20 m). Mỗi 30 s sinh thêm 1 con (event `shade_spawned`), tối đa 6 con. Id tăng dần S1, S2, …, bỏ qua id đã có. |
| A13 | Sinh đom đóm | Mặc định (random_motes true): 30 con rải ngẫu nhiên theo seed trong đảo. Khi còn < 30 con, cứ 4 s sinh thêm 1 con. `random_motes: false` → không sinh thêm. Id M1, M2, … |
| A14 | Đèn | 5 đèn L1..L5 trên vòng tròn bán kính 25 m: Li = (25·sin(72°·(i−1)), 0, 25·cos(72°·(i−1))), L1 = (0, 0, 25). |
| A15 | Thời lượng đêm | 300 s. Hết giờ (time_left ≤ 0) mà chưa thắp hết → thua `dawn`. |
| A16 | Điểm | +10/đom đóm, +100/đèn, +20/Bóng Mực bị stun. Khi **thắng**: +`floor(time_left_s)` × 1 và +flames × 50. Thua không có thưởng. |
| A17 | Thứ tự trong một bước | input → di chuyển/nhảy → nhặt → interact → pulse → Bóng Mực di chuyển (+ vùng an toàn) → va chạm → sinh thực thể → thời gian. Game kết thúc ở bước nào thì dừng xử lý phần còn lại của bước đó. |
| A18 | Snapshot | Chỉ ở tick chia hết cho `--snapshot-every` (kể cả 0). Không thêm snapshot ở tick kết thúc; dòng `end` luôn là dòng cuối. Có mảng `motes` (khuyến nghị). |
| A19 | Lỗi | File inputs/scenario không đọc được JSON hoặc sai cấu trúc → mã 2. Thiếu/sai tham số dòng lệnh → mã 1. `--night` khác 1 → mã 1. |

## 3. Tiêu chí nghiệm thu (mỗi dòng kiểm tra được)

| ID | Tiêu chí | Kiểm chứng |
|---|---|---|
| AC1 | Đứng yên N tick → `end.ticks = N`, `time_left_s = 300 − N/60` | scenario `idle` |
| AC2 | move [0,1] 60 tick → player z = 6.0 | scenario `walk_forward`, unit |
| AC3 | cam_yaw 90°, move [0,1] → đi theo +X | unit `camera yaw` |
| AC4 | Đi qua đom đóm → `mote_picked`, carried tăng, +10 điểm | scenario `pickup` |
| AC5 | Không nhặt quá `carry_capacity` | unit |
| AC6 | Nạp 5 vào L1 → `deposit` + `lantern_lit`, +100 | scenario `light_one` |
| AC7 | Thắp đủ 5 đèn → `game_over won all_lit` + thưởng thời gian/flame | scenario `win` |
| AC8 | Bóng Mực đuổi và chạm → `player_hit`, flames −1, rơi floor(carried·0.5) | scenario `hit` |
| AC9 | Bất tử 2 s sau khi trúng | unit |
| AC10 | 3 lần trúng → `game_over lost no_flames` | scenario `lose_flames` |
| AC11 | Hết giờ → `game_over lost dawn` | scenario `dawn` |
| AC12 | Pulse trong 6 m → `stunned`, bị đẩy 4 m, tốn 2 đom đóm, +20 | scenario `pulse` |
| AC13 | Pulse khi thiếu đom đóm / đang hồi chiêu → không có event | unit |
| AC14 | Bóng Mực không vào trong 5 m quanh đèn đã thắp | scenario `safe_zone` |
| AC15 | Scenario setup không phát event, không cộng điểm (đèn lit sẵn) | scenario `preset_lit` |
| AC16 | Cùng seed + scenario + inputs → output giống hệt byte | `tests/determinism.test.js` |
| AC17 | JSON hỏng / frames tick không tăng → exit 2 | unit CLI |
| AC18 | Mặc định (không scenario) có 30 đom đóm, 2 Bóng Mực, sinh thêm theo thời gian | scenario `default_spawn` |
| AC19 | Game 3D chơi được từ đầu tới thắng/thua, chơi lại được | ảnh chụp + video (thủ công) |

## 4. Đánh giá Phase 1

Xem mục "Đánh giá Phase 1" trong [docs/proof/phase-1/README.md](../proof/phase-1/README.md).
