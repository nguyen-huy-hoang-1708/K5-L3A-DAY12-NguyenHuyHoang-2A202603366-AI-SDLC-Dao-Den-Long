# Phase 3 — Ticket-03 "Đèn cạn dầu" + Test Contract v1.2

Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).

## 1. Test cũ bị luật mới làm sai → đã cập nhật (không skip test nào)

| Test cũ | Vì sao sai theo Ticket-03 | Xử lý |
|---|---|---|
| `AC1 idle` (time_left 300 → 290) | Đêm 1 còn 240 s | Sửa số: 240 → 230 |
| `AC6 light_one` (điểm 200) | Điểm mới: 10 × 5 + 100 | Sửa thành 150; `lantern_lit` có `relight: false` |
| `AC7/P2-16 win` (thắng ngay khi thắp đèn cuối) | **[THAY THẾ]** không còn thắng sớm | Viết lại: thắp đèn cuối không kết thúc Đêm; thêm scenario `dawn_win` / `dawn_lose` |
| unit `win on the very tick time runs out` | `all_lit` bỏ | Viết lại thành thắng `dawn_survived` ở tick cuối với ≥ 60% đèn sáng |
| unit `lighting a lantern evicts… still a win` | Không còn thắng sớm | Giữ phần "không sát thương khi bị đẩy ra", bỏ phần "thắng" |
| unit `partial deposit` (điểm 30) | +5/đom đóm | Sửa thành 15 |
| `P2-9 safe_evict` (điểm) | Điểm mới | Chỉ kiểm tra hành vi, không kiểm tra điểm |
| unit `nearest unlit lantern…lit skipped` | Đèn sáng giờ nhận dầu | Vẫn đúng vì đèn trong test đầy dầu (đầy thì không được chọn); đổi tên thành "full lanterns skipped" |
| giả định B10 (Bóng wander tới điểm ngẫu nhiên, 1.5 m/s) | Ticket-03: wander đi tới đèn yếu, không có thì tới đèn tắt gần nhất "như trước" | Đổi luật: wander tới đèn theo thứ tự ưu tiên đó, tốc độ bằng tốc độ Bóng (4.0, Đêm 3: 4.5) |
| mutation M9 (dawn) | Code thắng/thua viết lại | Viết lại mẫu đột biến |

## 2. Giả định cho chỗ ticket chưa nói rõ

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| C1 | `fuel_drain` "mỗi 60 tick khi đang hút" | Mỗi con có bộ đếm tick hút liên tục. Ghi event khi đếm tới 60, 120, … (ở bước 2, sau khi trừ dầu). Rời `drain` thì đếm lại từ 0. |
| C2 | Bóng wander khi không có đèn yếu và không có đèn tắt | Đứng yên (bị kẹt ở mép vùng an toàn nếu đang ở trong). |
| C3 | Bóng wander tới đèn tắt | Tới cách đèn ≤ 2 m thì dừng (không vào `drain`). |
| C4 | Scenario đèn `lit: true` không có `ever_lit` | `ever_lit = true`. `relit_count` mặc định 0. Đặt `fuel` cho đèn tắt thì bỏ qua (fuel = 0). |
| C5 | Bóng scenario `state: "drain"` không có `target_lantern_id` | Chọn đèn sáng gần nhất. Scenario không cho Bóng hút đèn tắt. |
| C6 | Chuyển `drain → chase` khi Mây ≤ 6 m | Đo theo XZ, giống phát hiện 12 m. |
| C7 | Châm dầu đèn đang yếu lên ≥ 30 | Bóng trong vùng 6 m bị đẩy ra trong 30 tick (dùng chung cơ chế với lúc thắp đèn). Bóng `drain` trên đèn đó chuyển `wander` ở bước 8. |
| C8 | Thắp lại đèn | Sự kiện `deposit` như lúc thắp lần đầu. `lantern_lit` có `relight: true`. `relit_count` + 1. `successful_lights` + 1. |
| C9 | Sức chứa giảm? | Không giảm trong Đêm. Nếu đang mang nhiều hơn sức chứa (scenario) thì không nhặt thêm. |
| C10 | Thưởng bình minh khi thua | Không có. `score` khi thua giữ phần đã tích lũy. |
| C11 | Chế độ mù màu | Chỉ là cài đặt của client, không ảnh hưởng headless. Hình đèn tắt bị xẹp và có vết rách hiển thị ở **cả hai chế độ**, để chế độ thường cũng dễ phân biệt. |

## 3. Tiêu chí nghiệm thu

| ID | Tiêu chí | Kiểm chứng |
|---|---|---|
| P3-1 | Contract v1.2: 8 khóa mới + thời lượng 240/270/300 | `tools/check-contract.js` |
| P3-2 | Thắp đèn: fuel = 100. Hao đúng 1/s (60 s → 40.0 sau khi đặt 100) | scenario `fuel_decay` |
| P3-3 | Hết dầu: `lantern_out` đúng tick (fuel 1 → tắt ở tick 60), deposited = 0, ever_lit = true, ambient giảm | scenario `fuel_out` |
| P3-4 | Châm dầu: used = min(mang, ceil((100−fuel)/10)), fuel tối đa 100, event `refuel`, +5/đom đóm. Đèn đầy không được chọn, không event | scenario `refuel`, unit |
| P3-5 | Thắp lại cần 5, +40, `relight: true`, `relit_count` | scenario `relight` |
| P3-6 | fuel < 30 mất vùng an toàn, đúng 30 vẫn còn | unit |
| P3-7 | Bóng wander → đèn yếu gần nhất → `drain` khi ≤ 2 m; hút 5/s cộng dồn, event `fuel_drain` mỗi 60 tick | scenario `drain` |
| P3-8 | `drain` → chase (Mây ≤ 6 m) / stunned (+15) / wander (đèn tắt, châm ≥ 30, > 2 m); châm ≥ 30 đẩy Bóng ra trong 30 tick | scenario `drain_exit`, unit |
| P3-9 | Thắng `dawn_survived` khi hết giờ và số đèn sáng ≥ ceil(0.6n); thua `dawn` nếu ít hơn; hết lửa luôn thua trước | scenario `dawn_win`, `dawn_lose`, unit |
| P3-10 | Thưởng bình minh: Σ(50 + floor(fuel)) + 50 × lửa | scenario `dawn_win` |
| P3-11 | Sức chứa 10 + 2 × lần thắp, tối đa 20; snapshot `player.capacity` | unit |
| P3-12 | Client: thanh dầu, nhấp nháy 1 Hz khi < 30, đèn tắt xẹp 20% + rách, Bóng hút có tia mực, HUD đang mang/sức chứa | ảnh playtest |
| P3-13 | Chế độ mù màu (lưu được): viền/mắt Bóng #00B3FF, cảnh báo UI #FFFFFF + ⚠ | `tests/palette.test.js`, ảnh |
