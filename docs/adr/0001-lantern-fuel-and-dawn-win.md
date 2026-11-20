# ADR 0001 — Đèn có nhiên liệu, Bóng Mực hút dầu, thắng khi sống tới bình minh

- Trạng thái: **Chấp nhận** (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- Thay thế: luật "đèn đã sáng không nhận thêm đom đóm", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi tất cả đèn sáng" (Ticket-02).

## Bối cảnh

Người chơi giỏi thắp hết đèn trong khoảng 2 phút rồi game kết thúc sớm, nên cuối Đêm thiếu căng thẳng. Ticket-03 đổi mục tiêu thành **giữ đảo sáng tới bình minh**: đèn cạn dầu, Bóng Mực hút dầu, và chỉ xét thắng khi hết giờ.

## Quyết định

### 1. Mô hình trạng thái đèn

Trước (Ticket-02): `unlit --(deposited ≥ 10)--> lit` (kết thúc, không đổi nữa).

Sau:

```
            nạp đủ cost (10 lần đầu / 5 nếu ever_lit)
  UNLIT ───────────────────────────────────────────▶ LIT (fuel = 100)
    ▲                                                  │  mỗi tick: fuel −= 1/60 (+ 5/60 × số Bóng đang drain)
    │ fuel ≤ 0  (deposited = 0, ever_lit = true,        │  E: châm dầu, used = min(mang, ceil((100−fuel)/10)), fuel += 10·used
    └──────────── lantern_out) ◀───────────────────────┘
  LIT có 2 mức: fuel ≥ 30 → có vùng an toàn 6 m; fuel < 30 → "đèn yếu": mất vùng an toàn, nhấp nháy 1 Hz, Bóng Mực wander tìm tới hút.
```

- **Đơn vị nguyên:** dầu lưu bằng số nguyên `fuelU` = fuel × 60 (1 đơn vị = 1/60 fuel). Mỗi tick đèn tự hao 1 đơn vị, mỗi con Bóng đang hút làm hao thêm 5 đơn vị. Châm 1 đom đóm tăng 600 đơn vị. Ngưỡng 30 fuel = 1 800 đơn vị, đầy = 6 000 đơn vị. Chỉ khi xuất ra mới chia 60 và làm tròn 1 chữ số. Nhờ vậy không có sai số số thực, và "đúng 30 thì vẫn còn vùng an toàn" được so sánh chính xác.
- Thêm trường `ever_lit`, `relit_count` cho đèn; `successful_lights` cho Mây (sức chứa = min(20, 10 + 2 × successful_lights)).
- Tương tác chọn trong **đèn nhận được** (chưa sáng, hoặc sáng nhưng chưa đầy) — gần nhất, bằng nhau thì id nhỏ hơn. Đèn đầy không bao giờ được chọn.

### 2. Bóng Mực: thêm trạng thái `drain`

```
 spawning → wander ──(Mây ≤ 12 m)──▶ chase ──(Mây > 18 m)──▶ wander
              │  mục tiêu: đèn sáng fuel < 30 gần nhất, nếu không có thì đèn tắt gần nhất
              └─(≤ 2 m tới đèn yếu)──▶ drain ──(Mây ≤ 6 m)──▶ chase
                                         ├─(trúng Tỏa Sáng)──▶ stunned ──▶ wander
                                         └─(đèn tắt / fuel ≥ 30 / cách > 2 m)──▶ wander
```

- Bóng `drain` đứng yên, không gây sát thương (chỉ `wander`/`chase` gây sát thương như Ticket-02).
- Lượng hút được trừ ở **bước 2** cùng lúc với hao tự nhiên. Ngay sau bước 2, đèn có fuel ≤ 0 thì tắt. Event `fuel_drain` được ghi cho mỗi con khi nó đã hút đủ 60 tick liên tục, rồi cứ mỗi 60 tick một lần.
- Tỏa Sáng trúng Bóng đang `drain` cho tổng **+15** (thay vì +5).
- Châm dầu làm đèn lên lại ≥ 30 thì các Bóng trong bán kính 6 m bị đẩy ra mép trong ≤ 30 tick, giống lúc đèn vừa thắp. Cơ chế này dùng lại `evictT` đã có.

### 3. Luật thắng/thua

- Bỏ thắng sớm (`all_lit` không còn dùng). Xét ở **bước 11**, sau mọi cập nhật của tick:
  1. Hết lửa → `lost / no_flames` (luôn ưu tiên trước, kể cả tick bình minh).
  2. Hết giờ → nếu số đèn đang sáng ≥ ceil(0.6 × tổng) thì `won / dawn_survived`, ngược lại `lost / dawn`.
- Thời lượng Đêm 1/2/3: 240/270/300 s.
- Điểm: +5 mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu); +100 khi thắp lần đầu; +40 khi thắp lại; +5 hoặc +15 cho mỗi Bóng trúng Tỏa Sáng. Khi thắng: mỗi đèn đang sáng được +50 + floor(fuel), mỗi lửa còn lại được +50. Bỏ thưởng thời gian.

## Hệ quả

- Test cũ dựa trên "thắng ngay" hoặc công thức điểm cũ **sai theo luật mới**. Các test này được viết lại theo luật mới, không bỏ qua test nào. Danh sách và lý do ở [docs/notes/phase-3.md](../notes/phase-3.md) §1.
- Bóng `wander` giờ đi tới đèn: đèn yếu nếu có, không thì đèn tắt gần nhất. Ticket-03 nói rõ hành vi này là "như trước", nên nó thay giả định B10 của Phase 2 (trước đây lượn tới điểm ngẫu nhiên).
- Client cần thêm thanh dầu, hiệu ứng nhấp nháy, hình đèn tắt (xẹp và rách), hình Bóng đang hút và chế độ mù màu. Phần hiển thị không ảnh hưởng headless; `tools/creative-check.sh` kiểm chứng điều này.

## Phương án đã cân nhắc

- **Lưu dầu bằng số thực**: đơn giản hơn, nhưng sai số làm lệch tick đèn tắt và ngưỡng 30. Không chọn.
- **Thêm trạng thái `weak` riêng cho đèn**: không cần, vì "yếu" suy ra được từ `fuel < 30`. Giữ ít trạng thái để snapshot đúng contract.
