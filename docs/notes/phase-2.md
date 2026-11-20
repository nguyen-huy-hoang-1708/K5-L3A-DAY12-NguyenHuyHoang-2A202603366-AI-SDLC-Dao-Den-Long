# Phase 2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1

Nguồn: Ticket-02 (lab board, tab Phase 2). Ticket **thay thế** mọi số tự chọn ở Phase 1 bằng số chuẩn (Phần 1) và bản đồ chuẩn (Phần 2).

## 1. Thay đổi so với Phase 1 (và lý do)

| Phase 1 (giả định cũ) | Phase 2 (theo ticket) | Ảnh hưởng tới test cũ |
|---|---|---|
| Đảo có lan can, `fall_enabled: false` (A8) | Ngoài bán kính là biển mây, rơi Y < −10 → mất lửa + toàn bộ đom đóm, hồi sinh sau 60 tick | Bỏ test "player is kept on island"; thay bằng scenario `fall` |
| Chi phí đèn 5, tương tác 2.5 m | 10 đom đóm, 2.0 m | Sửa số trong `light_one`, `win`, unit deposit |
| +10 điểm khi **nhặt** đom đóm | +10 mỗi đom đóm **nạp vào đèn** | Sửa `pickup` (điểm 0), `light_one` (100 + 10×10) |
| Pulse 2 đom đóm / 6 m / hồi 1 s / stun 3 s / đẩy tức thì 4 m / +20 | 3 / 5 m (3D, tâm chân+0.8) / 3 s / stun 120 tick / đẩy 4 m trong 15 tick / +5 | Sửa `pulse` và unit cooldown |
| Bị chạm: rơi đom đóm mất luôn, bất tử 2 s | Rơi floor(n/2) ra vành 1.5–2.5 m (nhặt lại được, TTL 480), bất tử 90 tick, Bóng lùi 2 m/60 tick | Sửa `hit` (tick trúng thay đổi do tốc độ 4.0 và bất tử 90) |
| Vùng an toàn 5 m, kẹp tức thì | 6 m; Bóng ở trong lúc đèn vừa thắp bị đẩy ra trong ≤ 30 tick, không gây sát thương | Sửa `safe_zone` |
| 30 đom đóm ngẫu nhiên + sinh mỗi 4 s; 2 Bóng lúc đầu + 1 con mỗi 30 s | 20 tại 20 điểm chuẩn, +1 mỗi 240 tick (trần 30); Bóng: 2 con tick 300 rồi mỗi 480 tick (Đêm 1), tối đa 6 | Sửa `default_spawn` |
| Bóng luôn đuổi | Trạng thái `spawning, wander, chase, recoil, stunned`; phát hiện 12 m / bỏ đuổi 18 m | Thêm unit |
| Thưởng thắng floor(s)×1 | floor(s)×2 + 50×lửa | Sửa `win` |
| `island_radius` trong tuning | Bỏ (bản đồ đã chuẩn hóa theo Đêm) | — |

Test cũ không bị tắt: mỗi test được **sửa số theo ticket** và giữ nguyên ý kiểm tra; riêng "kept on island" bị thay bởi scenario `fall` (luật đã đổi).

## 2. Giả định cho chỗ ticket chưa nói rõ

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Điểm xuất phát Đêm 2, 3 | Đêm 2: (0,0,0) trên đảo A. Đêm 3: tâm đảo là tháp chuông nên xuất phát **(0,0,−30)** (tầng 0, phía nam), quay mặt +Z. Hồi sinh tại điểm xuất phát của Đêm. |
| B2 | Tăng tốc/dừng ≤ 0.1 s | Vận tốc ngang đặt **tức thì** (0 s ≤ 0.1 s) → đi 60 tick = đúng 6.0 m. |
| B3 | Tích phân nhảy | Euler bán ẩn: `vy -= 20/60; y += vy/60`. Chạm đất khi y ≤ mặt đất → y = mặt đất, vy = 0. |
| B4 | Vách đứng / bậc | Mặt đất cao hơn chân > 0.35 m là tường (thử đi cả XZ, rồi chỉ X, rồi chỉ Z). Xuống dốc: đang chạm đất và mặt mới thấp hơn ≤ 0.35 m thì bám dốc; thấp hơn nữa thì rơi. Tháp chuông = trụ cao 14 m, là tường. |
| B5 | Lướt trên bục phóng | Trong 12 tick lướt, vận tốc ngang = lướt, độ cao giữ nguyên (vy tạm giữ); hết lướt thì vận tốc phóng và vy cũ tiếp tục. Không nhảy khi đang lướt. Lướt trên đất không tự rơi trừ khi đi ra khỏi mép. |
| B6 | Bục phóng kích hoạt | Khi Mây **đang chạm đất** và chân trong bán kính 1 m của bục (XZ), đầu bước di chuyển. |
| B7 | Tương tác đèn | XZ ≤ 2.0 m **và** chênh cao chân–chân cột ≤ 1.5 m (không nạp xuyên tầng ở Đêm 3). |
| B8 | Trần 30 đom đóm | Đếm mọi đom đóm đang có (ngẫu nhiên + rơi). "Điểm trống" = điểm sinh chưa có đom đóm `random` nằm trên đó. Chọn ngẫu nhiên theo seed. |
| B9 | Thực thể mới | Bóng Mực/Gió Lạc sinh ở bước 10 có trạng thái `spawning` (Bóng) hoặc `idle` (Gió) và chỉ di chuyển/tương tác từ tick sau. Bóng `spawning` kéo dài đúng 1 tick rồi thành `wander`. |
| B10 | Bóng `wander` | Lượn 1.5 m/s tới một điểm sinh đom đóm ngẫu nhiên (theo seed), tới nơi thì chọn điểm khác. Chuyển `chase` khi Mây cách ≤ 12 m (XZ); bỏ đuổi khi > 18 m. Không đuổi khi Mây đang chờ hồi sinh. |
| B11 | Độ cao Bóng/Gió | Bóng giữ độ cao lơ lửng so với mặt đất bên dưới (sinh ra: tâm = mặt đất + 1.0 m; trên biển mây coi mặt đất = 0). Gió Lạc: mặt đất + 1.5 m. Bóng/Gió bay qua mọi địa hình. |
| B12 | Bóng gây hit | Chỉ `wander`/`chase`, không đang bị đẩy ra khỏi vùng an toàn. Xét theo số thứ tự id (S2 trước S10). Bóng chạm Mây khi Mây bất tử: không gì xảy ra. |
| B13 | Vật cản khi bị đẩy | Vùng an toàn của đèn đã sáng là vật cản: bị đẩy tới mép 6 m thì dừng. |
| B14 | Bóng ở trong vùng lúc đèn vừa thắp | Bị đẩy thẳng ra mép theo đường xuyên tâm, đều trong 30 tick (không di chuyển khác, không gây hit); trạng thái giữ nguyên. |
| B15 | Gió Lạc sau khi bị pulse lúc đang chạy trốn | Thả toàn bộ đom đóm đã cướp (thành `dropped`, TTL 480), `stolen = 0`, vẫn bay trốn, chuyển `removed` sau 120 tick. Gió `removed` giữ trong mảng `drifters` (vị trí đứng yên), không còn tính vào trần 2. |
| B16 | Gió Lạc sinh | Tick 1200, 2400, … (chỉ Đêm 2, 3 hoặc khi scenario có), tại một điểm sinh Bóng Mực ngẫu nhiên; nếu đang có 2 con chưa `removed` thì bỏ lượt. Lượn `idle` 2 m/s. |
| B17 | Cơn gió | Đêm 3 (hoặc `wind_enabled: true`): hoạt động trong tick [1800k, 1800k+300), k ≥ 1; hướng chọn theo seed lúc bắt đầu báo trước (tick 1800k − 120). Gió cộng 2 m/s vào dịch chuyển ngang (kể cả trên không/lướt/bay), không tính vào `player.vel`. `dir_deg` đo từ +X ngược chiều kim đồng hồ: hướng = (cos, sin) trên (x, z). |
| B18 | Góc trên bản đồ | Điểm ở góc a, bán kính r: (r·cos a, y, r·sin a) — khớp với "tầng 1 ở nửa z > 0" và dốc ở 30°, 150°. |
| B19 | Tạm dừng | Nhấn `pause` (cạnh lên) để bật/tắt. Lúc vừa bật: ghi `paused {}`, dừng bước. Lúc tắt: ghi `resumed {}` rồi chạy bước bình thường. Khi dừng: nút khác vẫn được ghi nhận trạng thái (không kích hoạt sau khi tiếp tục nếu đang giữ). |
| B20 | `night_start` | Ghi ở tick 0, trước snapshot tick 0. |
| B21 | Trường snapshot | `player.invuln` là boolean, thêm `invuln_s`; `motes[].ttl_s` = null với đom đóm `random`; thêm `facing_deg`, `respawn_s`, `shades[].ticks_left`, `charms[].pos` (trường thêm, không thay trường bắt buộc). |
| B22 | Điểm khi thua | Điểm tích lũy trong Đêm vẫn hiện ở `score`/`end`; tổng điểm game (client) chỉ cộng các Đêm thắng. |
| B23 | `pulse.stunned_ids` | Chỉ id Bóng Mực trúng (gồm con đang choáng). Gió Lạc trúng thể hiện qua `drifter_drop` / đổi trạng thái. |

## 3. Tiêu chí nghiệm thu (Phần 1 + Phần 3)

| ID | Tiêu chí | Kiểm chứng |
|---|---|---|
| P2-1 | `game.contract.json` v1.1 khớp số chuẩn, có 5 khóa mới | `tools/check-contract.js` |
| P2-2 | Lướt: 12 tick × 14 m/s = 2.8 m theo hướng di chuyển/hướng mặt; hồi 90 tick từ lúc bắt đầu; trên không giữ độ cao; event `dash` | scenario `dash`, unit |
| P2-3 | Nhảy 7 m/s, g −20; chỉ khi chạm đất | unit |
| P2-4 | Rơi khỏi đảo: 1 event `player_hit{by:fall,lost}`, chờ 60 tick, hồi sinh tại xuất phát, bất tử 90; hết lửa → thua ngay | scenario `fall`, `fall_last_flame` |
| P2-5 | Đom đóm: 20 lúc đầu tại điểm chuẩn khác nhau, +1 mỗi 240 tick, trần 30 | scenario `default_spawn` |
| P2-6 | Bị đánh: rơi floor(n/2) ra vành 1.5–2.5 m, TTL 480, nhặt lại từ tick sau; bất tử 90; Bóng `recoil` 60 tick | scenario `hit`, `dropped_ttl` |
| P2-7 | Pulse 3/5 m/3 s, 3D từ tâm chân+0.8, stun 120, đẩy 4 m trong 15 tick, +5 mỗi con kể cả đang choáng | scenario `pulse` |
| P2-8 | Bóng: `spawning → wander → chase` (12/18 m), tốc độ 4.0 (Đêm 3: 4.5), lịch sinh 300 + 480k (Đêm 1), tối đa 6/8/10 | scenario `shade_schedule`, unit |
| P2-9 | Vùng an toàn 6 m + đẩy ra trong 30 tick khi đèn vừa thắp | scenario `safe_zone`, `safe_evict` |
| P2-10 | Đêm 2: 6 đèn, 2 đảo + cầu; bục phóng đưa sang đảo kia trong ~1.4 s | scenario `n2_pad` |
| P2-11 | Đêm 3: 7 đèn, tầng/dốc/vách; bục (0,3,13) đưa lên tầng 2; tốc độ Bóng 4.5 | scenario `n3_ramp_pad` |
| P2-12 | Gió mạnh Đêm 3: 300 tick mỗi 1800, 2 m/s, snapshot `wind` | scenario `wind` |
| P2-13 | Gió Lạc: idle→chase (≥5, ≤15 m), cướp min(3,n) khi XZ ≤ 1.2, flee 240 tick rồi removed; pulse lúc chase → flee không cướp; pulse lúc flee có đồ → thả lại | scenario `drifter_steal`, `drifter_pulse` |
| P2-14 | Bùa Gió: nhặt → 600 tick, tốc độ 7.2, lướt không hồi chiêu; hồi lại sau 2700 tick | scenario `charm` |
| P2-15 | Tạm dừng: tick tăng, `sim_tick`/thời gian/spawn đứng yên, `state: "paused"`, event `paused`/`resumed` | scenario `pause` |
| P2-16 | Thắng/thua xét sau mỗi tick đúng thứ tự (no_flames > all_lit > dawn); thưởng floor(s)×2 + 50×lửa | scenario `win`, unit |
| P2-17 | Một Đêm đầy đủ 21 600 tick headless ≤ 30 s | `tools/proof.js` đo thời gian |
| P2-18 | Chuỗi 3 Đêm, menu, giới thiệu Ông Đăng, kết quả, Bình Minh, chơi lại Đêm thua | playtest client |
| P2-19 | Tạm dừng Esc/P (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu); cài đặt âm lượng + độ nhạy chuột lưu `localStorage` | playtest client |
| P2-20 | HUD đầy đủ theo bố cục ticket; đồng hồ đỏ nhấp nháy ≤ 30 s; mũi tên tới đèn gần nhất ngoài màn hình | ảnh playtest |
| P2-21 | Bảng màu chuẩn (±10%/kênh) cho các thành phần liệt kê; ánh sáng môi trường = 0.15 + 0.55 × tiến độ | `tests/palette.test.js` đọc hằng số màu của client |
| P2-22 | ≥ 30 FPS trung bình ở 1280×720 | playtest đo FPS |
