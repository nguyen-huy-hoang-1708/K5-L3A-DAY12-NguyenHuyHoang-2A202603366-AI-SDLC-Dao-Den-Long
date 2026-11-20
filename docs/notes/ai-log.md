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

## Phase 2

### Lời nhắc chính
- Dán nguyên văn Ticket-02 vào phiên; yêu cầu làm theo hướng dẫn lab, không push.

### Trình tự
1. Viết `docs/notes/phase-2.md` trước: bảng **thay đổi so với Phase 1** (test cũ bị ảnh hưởng), 23 giả định, 22 tiêu chí nghiệm thu.
2. Viết lại `src/sim.js` theo đúng 11 bước của ticket + `src/maps.js` → CLI v1.1 → sửa test Phase 1 theo số chuẩn → scenario cho mỗi tính năng mới → mutation → client → playtest → proof.

### AI sai ở đâu & cách phát hiện
| # | Sai | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 7 | Bóng Mực hết `recoil` lại đuổi thêm một bước trong cùng tick (đi 2 bước/tick) | Tính tay lịch trúng đòn trước khi viết test | Cờ `busy` (recoil/evict thay thế AI trong tick đó) |
| 8 | Test bục phóng Đêm 2 kỳ vọng bay cao > 5 m, thực tế vy²/2g = 4.9 m | Test đỏ → debug quỹ đạo → kỳ vọng sai, code đúng | Sửa ngưỡng; thêm quy tắc vào AGENTS: kỳ vọng phải tính tay từ số chuẩn |
| 9 | Test "lửa hết cùng tick thắp đèn" thực ra kiểm tra thắng (vùng an toàn đẩy Bóng ra) — tên test sai ý | Đọc lại test sau khi xanh | Viết lại thành 2 test đúng ý (ưu tiên no_flames; evict không sát thương) |
| 10 | Mutation check báo 2 đột biến sống sót (bỏ bất tử; hồi sinh ngay) và 1 không áp dụng được (lịch Đêm 2 nằm ở `maps.js`) | `tools/mutation-check.sh` | Thêm test 2 Bóng cùng chạm, test chờ 60 tick, test lịch Đêm 2/3; script mutation nhận file `maps.js` |
| 11 | Bot playtest trốn trong vùng an toàn chờ Bóng bỏ đi → kẹt cả đêm (Bóng ở mép 6 m vẫn < 18 m nên không bỏ đuổi) | Ảnh cuối playtest | Bỏ luật chờ của bot; ghi nhận bot chưa thắng được Đêm 2/3 (chưa đạt một phần) |
| 12 | Ảnh `07-dawn.png` được chụp dù chưa tới Bình Minh (ảnh sai nội dung) | Xem lại danh sách ảnh | Chỉ chụp khi `screen === 'dawn'`; chuyển ảnh sai ra khỏi bằng chứng |

## Phase 3

### Lời nhắc chính
- Dán nguyên văn Ticket-03 (change request) vào phiên.

### Trình tự
1. Viết ADR 0001 và `phase-3.md` trước: bảng **test cũ bị luật mới làm sai** và cách xử lý, 11 giả định, 13 tiêu chí.
2. Sửa sim. Dầu lưu bằng đơn vị nguyên 1/60 theo khuyến nghị của ticket.
3. Viết lại test cũ (không skip test nào) và thêm 9 scenario. Chạy mutation check ngầm trong lúc làm client.
4. Làm client và chế độ mù màu, chạy playtest, sinh bằng chứng.

### AI sai ở đâu & cách phát hiện
| # | Sai | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 13 | **Lỗi thật**: điều kiện vào `drain` có dung sai 1e-9, điều kiện ra thì không. Ở 2.0000000001 m, Bóng lật qua lại `drain`/`wander`, nên event `fuel_drain` chậm 2 tick | Scenario `drain` kỳ vọng tick 105 (tính tay), thực tế 107 → trace từng tick | Dùng cùng dung sai cho cả hai chiều; thêm quy tắc vào AGENTS |
| 14 | Kỳ vọng dầu sau 10 tick là 99.8; đúng ra đèn thắp ở tick 1, chỉ hao 9 tick nên 99.85 làm tròn thành 99.9 | Test đỏ → đếm lại tick | Kỳ vọng sai, code đúng; sửa kỳ vọng kèm chú thích cách tính |
| 15 | Client vẫn vẽ vòng an toàn cho đèn yếu, dù đèn đó đã mất vùng an toàn (sai luật về mặt hình ảnh) | Xem ảnh playtest `10-night1-lantern-out` | Ẩn vòng khi fuel < 30 rồi chụp lại |
| 16 | Đèn trên nón của Mây quá sáng khi mang nhiều đom đóm (bloom làm chói nhân vật) | Ảnh `03-night1-play` | Giảm cường độ |

### Token / chi phí (ước tính)
- Không có số đo chính xác trong phiên; ước tính theo độ dài phiên: khoảng **60–80k token output** và **~2–3M token input** (phần lớn là ngữ cảnh được cache đọc lại mỗi lượt). Cập nhật số thật từ trang usage của Claude nếu cần.
- Cách tiết kiệm: đọc tài liệu lab một lần và tóm tắt vào notes; một module luật dùng chung (không viết luật hai lần); không thêm dependency (không `npm install`, không đọc tài liệu thư viện); dùng script sinh bằng chứng thay vì chụp/đọc ảnh nhiều lần; chỉ đọc 4 ảnh để kiểm tra trực quan.
- Phase 2 (ước tính theo độ dài phiên): khoảng **120–160k token output**, **~6–9M token input** (chủ yếu ngữ cảnh được cache). Tiết kiệm: viết spec + bảng thay đổi trước để agent không đoán; một lần viết lại sim thay vì vá nhiều lần; test chạy qua CLI thật; bot playtest chạy ngầm chỉ đọc ảnh cần thiết (≈ 8 ảnh); không đọc lại file lớn khi không cần.
- Phase 3 (ước tính): khoảng **60–80k token output**, **~4–6M token input**. Cách tiết kiệm: sửa sim bằng một script thay thế có kiểm tra số lần khớp, không viết lại cả file. Chạy mutation check ngầm song song với việc sửa client. Chỉ đọc 4 ảnh.
