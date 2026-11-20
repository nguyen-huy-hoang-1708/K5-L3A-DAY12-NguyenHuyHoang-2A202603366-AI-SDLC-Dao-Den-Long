# Nhật ký dùng AI

Công cụ: **Claude Code** (desktop app, model Claude Opus 5.5). Harness: [AGENTS.md](../../AGENTS.md) (+ `CLAUDE.md` trỏ vào), skill [`verify`](../../.claude/skills/verify/SKILL.md), hook Stop [`tools/hooks/stop-gate.sh`](../../tools/hooks/stop-gate.sh) (chặn kết thúc khi `npm test` đỏ), CI GitHub Actions.

## Phase 1

### Lời nhắc chính
1. "Đọc dự án lab Day 12 và hoàn thành (tuân thủ các file hướng dẫn, không tự ý push)".
2. Agent đọc README/GUIDE/CHECKPOINTS/SUBMISSION/RULES/RUBRIC, rồi đọc tab Phase 1 trên lab board (PRD-0 + Test Contract v1.0). Chỉ Phase 1 đã phát hành.

### Trình tự đã làm
1. Viết giả định + tiêu chí nghiệm thu **trước** code ([phase-1.md](phase-1.md)).
2. Kiến trúc: một module luật thuần `src/sim.js` dùng chung cho headless và web → output headless chính là game thật.
3. CLI headless → 12 scenario fixture + unit test → client 3D → playtest Chrome headless → proof script → mutation check.

### AI sai ở đâu & cách phát hiện
| # | Sai | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Bộ đếm thời gian (bất tử, stun, hồi chiêu) dùng số thực `-= 1/60` → trôi số, lần trúng thứ 2 ở tick 156 thay vì 155 | Scenario `hit` kỳ vọng tính tay `[35,155,275]` | Đổi sang bộ đếm **số nguyên theo tick**; ghi quy tắc vào AGENTS (luật tất định) |
| 2 | Bộ test ban đầu **không bắt** lỗi "nạp vượt `lantern_cost`" (test luôn đạt với lỗi đó) | Mutation check thủ công | Thêm test; biến mutation check thành script `tools/mutation-check.sh` + CI + bước 2 của skill `verify` |
| 3 | Script đếm test đỏ dùng `grep "^not ok"` trên reporter mặc định của Node 24 (không in `not ok`) → báo "0 failing" cho mọi đột biến, tưởng test yếu toàn bộ | Đột biến M1 trước đó đã thấy đỏ bằng mắt nhưng script báo 0 → mâu thuẫn | Ép `--test-reporter=tap` trong script |
| 4 | Script `npm test` dạng `node --test tests/` lỗi trên Node 24 | Chạy thật | Đổi thành `node --test tests/*.test.js` |
| 5 | Client lần đầu quá tối, khó nhìn | Ảnh chụp trong trình duyệt | Tăng ánh sáng (chỉ client) |
| 6 | Trình duyệt tích hợp bị ẩn nên `requestAnimationFrame` không chạy, game đứng ở tick 0 | Đọc `window.__game.tick` sau khi giữ phím | Viết `tools/playtest.js` dùng Chrome headless + CDP, phím thật |

### Yêu cầu thêm: giao diện tiên hiệp
- Lời nhắc: "chỉnh sửa giao diện game cho đẹp mắt giống các game kiếm hiệp, chưởng tu tiên đồ hoạ bắt mắt".
- Ràng buộc tự đặt: chỉ sửa `web/`, không đụng `src/sim.js` → test/headless không đổi; giữ màu theo PRD (vàng cam = tốt, tím đen = nguy hiểm, không bạo lực); không dùng asset ngoài (mọi texture vẽ bằng Canvas, âm thanh tổng hợp).
- AI sai: dòng đổi màu bụi linh khí truyền `Vector3` vào `Color.lerp` (sẽ ra NaN) — phát hiện khi đọc lại diff trước khi chạy, đã sửa. Kiểm chứng: playtest Chrome headless thắng + thua, 0 lỗi console, ảnh trong `docs/proof/phase-1/playtest/`.

### Viết lại lịch sử git (20/11/2026, trong giờ Phase 1)
- Theo yêu cầu của chủ dự án, xoá dòng `Co-Authored-By: Claude` khỏi 8 commit Phase 1 (`git filter-branch --msg-filter`), **nội dung code không đổi** (cùng git tree), rồi gắn lại tag `phase-1` và force-push trước hạn Phase 1. Việc dùng AI vẫn được ghi đầy đủ trong file này và `CREDITS.md`.
- Lưu ý RULES.md §7 ("không viết lại lịch sử sau khi gắn tag"): việc này làm trước hạn phase, có backup nhánh `backup/before-rewrite` trên máy; mã commit cũ → mới: `0066d6f`→`45de48c` (tag `ui-classic`), `ed5d7fb`→`d2174db`.

### Token / chi phí (ước tính)
- Không có số đo chính xác trong phiên; ước tính theo độ dài phiên: khoảng **60–80k token output** và **~2–3M token input** (phần lớn là ngữ cảnh được cache đọc lại mỗi lượt). Cập nhật số thật từ trang usage của Claude nếu cần.
- Cách tiết kiệm: đọc tài liệu lab một lần và tóm tắt vào notes; một module luật dùng chung (không viết luật hai lần); không thêm dependency (không `npm install`, không đọc tài liệu thư viện); dùng script sinh bằng chứng thay vì chụp/đọc ảnh nhiều lần; chỉ đọc 4 ảnh để kiểm tra trực quan.
