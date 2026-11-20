# Retro dự án

_Sẽ viết đầy đủ ở cuối Phase 4 (số liệu cả dự án, bài học, nếu làm lại thì đổi gì)._ Đánh giá từng phase: `docs/proof/phase-N/README.md`; lỗi của AI và token: [ai-log.md](ai-log.md).

## Ghi nhanh sau Phase 1
- Hiệu quả: viết giả định + tiêu chí trước; một module luật dùng chung cho headless và game; mutation check phát hiện test yếu thật.
- Chưa hiệu quả: mất thời gian vì công cụ (reporter Node 24, trình duyệt bị ẩn) — nên chạy thử công cụ kiểm chứng sớm hơn.

## Ghi nhanh sau Phase 2
- Hiệu quả: bảng "thay đổi so với Phase 1" trước khi code giúp sửa test cũ có lý do, không tắt test nào; viết lại sim một lần theo đúng 11 bước ticket; mutation check tiếp tục tìm ra test yếu (bất tử, thời gian chờ hồi sinh, lịch Đêm 2).
- Chưa hiệu quả: bot playtest quá đơn giản cho Đêm 2/3 → chưa chứng minh được Bình Minh bằng bot; FPS phụ thuộc GPU nên phải đo bằng Chrome dùng Metal.
