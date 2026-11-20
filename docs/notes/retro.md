# Retro dự án — Đảo Đèn Lồng (Day 12 · AI SDLC)

Thực hiện với Claude Code (Claude Opus 5.5) qua 4 phase: PRD-0 rồi Ticket-02, 03, 04. Chi tiết từng phase nằm trong `docs/notes/phase-N.md` (giả định, tiêu chí nghiệm thu) và `docs/proof/phase-N/README.md` (truy vết, đánh giá). Nhật ký từng lần AI sai: [ai-log.md](ai-log.md).

## 1. Số liệu cả dự án

| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Contract | v1.0 | v1.1 | v1.2 | v1.3 |
| Test (`npm test`) | 33 | 65 | 77 | 89 |
| Scenario headless | 12 | 27 | 36 | 36 (+ bench/soak) |
| Đột biến bị bắt / tổng | 10/10 | 26/26 | 39/39 | 41/41 |
| Lần AI sai được ghi lại | 6 | 6 | 4 | 3 |
| Đánh giá | Đạt toàn bộ | Headless đạt toàn bộ; bot chưa thắng Đêm 2/3 | Đạt toàn bộ luật; bot chưa thắng Đêm | Bench, soak, bảng xếp hạng, a11y đạt; bot chưa thắng Đêm |

Số đo cuối cùng:
- **Bench** (M1 Pro, cửa sổ Chrome 1280×720, vsync tắt): `avg_fps` 236.8, `p1_low_fps` 145.7, `load_ms` 2164.
- **Soak**: 10 Đêm, 0 crash, RSS ×1.05.
- **Headless**: một Đêm 21 600 tick chạy dưới 0.35 s.
- **Client**: khoảng 58 FPS khi chơi bình thường (bị giới hạn bởi vsync).

## 2. Đánh giá tổng hợp 4 phase

- **Phase 1**: đạt toàn bộ PRD-0 và contract v1.0. Đổi giao diện sang phong cách tiên hiệp mà không đổi đầu ra headless (đã kiểm chứng bằng so sánh từng byte).
- **Phase 2**: số chuẩn thay mọi giả định cũ. Test Phase 1 được sửa số, không tắt test nào. 3 Đêm, đủ tính năng, có scenario cho từng tính năng. **Chưa đạt**: bot chưa thắng Đêm 2/3 trong client.
- **Phase 3**: change request thay luật lõi. Có ADR 0001, bảng test bị ảnh hưởng, changelog breaking changes. Tính tay kỳ vọng trước tìm ra **một lỗi thật** (dung sai vào/ra `drain` khác nhau).
- **Phase 4**: contract v1.3, bench, soak, bảng xếp hạng lưu đĩa và xuất được, đổi phím, phụ đề, giảm chuyển động, chữ ≥ 18 px, gói Release, video. Đầu ra headless giống hệt Phase 3 (38/38).
- **Phase trước có bị hỏng không?** Không. Các luật cũ chỉ đổi khi ticket ghi rõ là [THAY THẾ].

## 3. Điều hiệu quả / không hiệu quả khi làm với AI

**Hiệu quả**
- **Viết giả định và tiêu chí trước khi code.** Khi ticket mới đến, bảng "thay đổi so với phase trước" cho biết ngay test nào phải sửa và vì sao.
- **Một module luật thuần, tất định, dùng chung cho headless và game.** Nhờ vậy không có hai phiên bản luật lệch nhau, và đầu ra headless chính là game thật.
- **Test chạy qua lệnh CLI thật**, đúng như cách giảng viên chấm.
- **Mutation check** tìm ra test yếu ở cả 3 phase: nạp vượt chi phí, bỏ bất tử, thời gian chờ hồi sinh, lịch sinh Đêm 2. Đây là biện pháp chống "test luôn đạt" hiệu quả nhất.
- **Tính tay kỳ vọng trước khi chạy test.** Khi test đỏ thì kiểm tra cả kỳ vọng lẫn code, không sửa kỳ vọng cho khớp output. Nhờ vậy phát hiện được 1 lỗi thật và 3 kỳ vọng sai.

**Không hiệu quả**
- **Bot playtest quá đơn giản** (đi thẳng, né đơn giản). Bot chưa bao giờ thắng Đêm 2/3, nên màn Bình Minh chưa được chứng minh bằng client. Lẽ ra nên đầu tư tìm đường và chiến thuật sớm hơn, hoặc làm chế độ "tua nhanh" có kiểm chứng.
- **Mất thời gian vì công cụ**: reporter mặc định của Node 24, trình duyệt bị ẩn nên rAF dừng, kích thước cửa sổ khi bench, chạy không GPU. Nên chạy thử chuỗi công cụ kiểm chứng ngay ở phase đầu.
- **Đo token**: chỉ có ước tính theo độ dài phiên, không có số chính xác.

## 4. Những lần AI sai và cách phát hiện (tóm tắt — đầy đủ 19 mục trong ai-log)

| Loại lỗi | Ví dụ | Cách phát hiện |
|---|---|---|
| Lỗi logic thật | Bộ đếm dùng số thực trôi 1 tick; Bóng di chuyển 2 bước sau `recoil`; dung sai vào/ra `drain` lệch nhau | Scenario có kỳ vọng tính tay |
| Test yếu hoặc "luôn đạt" | Nạp vượt chi phí, bỏ bất tử, hồi sinh ngay, lịch sinh Đêm 2 không bị bắt | `tools/mutation-check.sh` |
| Kỳ vọng sai | Đỉnh bục phóng 4.9 m chứ không > 5 m; dầu 99.85 làm tròn thành 99.9 | Test đỏ → tính lại → kỳ vọng sai, code đúng |
| Test đặt tên sai ý | Test "lửa hết cùng tick thắp đèn" thực ra kiểm tra thắng | Đọc lại test sau khi xanh |
| Bằng chứng sai nội dung | Ảnh "Bình Minh" chụp khi chưa tới Bình Minh; ảnh chụp trước khi sửa giao diện | Xem lại thư mục ảnh và thời điểm chụp |
| Hiểu sai số đo | Tưởng RSS tăng là rò rỉ; vùng vẽ bench sai kích thước | Đo `heapUsed`; đọc trường `window` trong `bench.json` |

## 5. Harness nào giúp nhiều nhất

1. **`tools/mutation-check.sh` (chạy trong CI và là bước 2 của skill `verify`)**. Không có nó, ít nhất 5 test yếu đã lọt qua.
2. **Hook Stop (`tools/hooks/stop-gate.sh`)**: agent không thể kết thúc khi `npm test` đỏ. Hook chặn đúng khi thử với test đỏ.
3. **`AGENTS.md` ngắn và cập nhật theo lỗi**. Các quy tắc mới đều đến từ lỗi đã gặp: bộ đếm số nguyên, kỳ vọng tính tay, dùng cùng dung sai, không thêm dòng co-author, ghi lý do khi luật bị thay thế. Lịch sử git cho thấy file này được cập nhật qua từng phase.
4. **Skill `verify`**: một quy trình cố định để sinh bằng chứng cho mỗi phase.
5. **`tools/creative-check.sh`**: chứng minh phần sáng tạo không đổi đầu ra headless.

## 6. Token / chi phí

- Ước tính theo độ dài phiên: Phase 1 khoảng 70k token output, Phase 2 khoảng 140k, Phase 3 khoảng 70k, Phase 4 khoảng 105k. Tổng khoảng **0.35–0.45M token output và 18–27M token input**, phần lớn là ngữ cảnh được cache đọc lại. **Đây là ước tính, chưa phải số đo.**
- Cách tiết kiệm:
  - Không có dependency nên không phải đọc tài liệu thư viện.
  - Sửa code bằng script thay thế có kiểm tra số lần khớp, không viết lại cả file.
  - Bằng chứng do script sinh ra, không mô tả tay.
  - Chạy các việc dài (mutation, playtest) ngầm hoặc song song.
  - Chỉ đọc ảnh khi cần kiểm tra trực quan (khoảng 25 ảnh cho cả dự án).
  - Không chạy lại agent nhiều lần cho cùng một việc.

## 7. Nếu làm lại thì đổi gì

- **Viết bot playtest có tìm đường và chiến thuật ngay từ Phase 2**, để chứng minh trọn chuỗi 3 Đêm và màn Bình Minh trong client.
- Chạy thử toàn bộ chuỗi công cụ kiểm chứng (Chrome headless + GPU, reporter của Node, bench có cửa sổ) ngay ở Phase 1.
- Ghi số token thật sau mỗi phase thay vì ước tính cuối buổi.
- Hỏi trợ giảng về các giả định rủi ro nhất trước khi code (ví dụ điểm xuất phát Đêm 3, dung sai chạm), thay vì chỉ ghi lại.
