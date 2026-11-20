# AGENTS.md — Đảo Đèn Lồng

Game 3D web (Three.js) + headless Node theo **Test Contract v1.2** (Ticket-02 số chuẩn, 3 Đêm; Ticket-03 đèn có dầu, thắng ở bình minh — xem `docs/adr/`). Yêu cầu gốc: lab board (tab Phase N). Giả định & tiêu chí nghiệm thu: `docs/notes/phase-N.md`.

## Lệnh
- Test (contract + unit + scenario + determinism): `npm test`
- Headless: `node headless/run.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chạy game: `node tools/serve.js` → http://localhost:8080/web/
- Bằng chứng headless: `node tools/proof.js phase-N` · Playtest client thật: `node tools/playtest.js --mode campaign|lose --gpu [--night N] --out docs/proof/phase-N/playtest`
- Kiểm tra test không "luôn xanh": `tools/mutation-check.sh`
- Sáng tạo không đổi output headless: `tools/creative-check.sh` (chạy bản sao không có `web/`)

## Kiến trúc
- `src/sim.js`: **toàn bộ luật chơi**, thuần, tất định (mulberry32(seed)); `step()` theo đúng 11 bước thứ tự bắt buộc của Ticket-02. Mọi bộ đếm là **số nguyên tick** (không cộng dồn 1/60). Không `Math.random`/`Date`/DOM ở đây.
- Dầu đèn lưu bằng **đơn vị nguyên 1/60** (`fuelU`, đầy = 6000, ngưỡng yếu 1800); chỉ chia 60 khi xuất. So sánh khoảng cách dùng cùng dung sai ở cả hai chiều chuyển trạng thái (vào/ra `drain`).
- Luật bị ticket **thay thế**: sửa test cũ + ghi lý do trong `docs/notes/phase-N.md` §1, thêm ADR trong `docs/adr/`, ghi breaking change trong `CHANGELOG.md`.
- `src/maps.js`: bản đồ chuẩn 3 Đêm (góc a → (r·cos a, y, r·sin a)); `surface(x,z)` = mặt đất cao nhất hoặc `null` (biển mây).
- `web/palette.js`: màu chuẩn; client **chỉ** lấy màu các thành phần ticket liệt kê từ đây (`tests/palette.test.js`).
- `src/inputs.js`: đọc file inputs. `headless/run.js`: CLI contract. `web/main.js`: chỉ hiển thị + bàn phím → input contract.
- Số tuning nằm ở `TUNING` trong `src/sim.js` và **phải trùng** `game.contract.json` (`tools/check-contract.js` chặn lệch).

## Quy tắc
- Đổi luật → sửa `src/sim.js`, thêm/sửa test trong `tests/`, cập nhật `docs/notes/phase-N.md` (giả định) cùng commit. Mỗi tính năng mới ≥ 1 scenario headless trong `tests/scenarios/<tên>/` (+ `meta.json` `{"night": N}`).
- Kỳ vọng trong test phải **tính tay từ số chuẩn** trước khi chạy (vd. đỉnh bục phóng = vy²/2g = 4.9 m); nếu test đỏ, kiểm tra cả kỳ vọng lẫn code — không sửa kỳ vọng cho khớp output.
- Không bịa yêu cầu: dẫn nguyên văn ticket khi không chắc; chỗ mơ hồ ghi thành giả định.
- Sáng tạo thêm chỉ ở `web/` (hiển thị/âm thanh) hoặc tắt trong headless; không làm đổi output JSONL.
- Test cũ bị luật mới thay thế: sửa hoặc xoá **kèm lý do** trong notes, không skip âm thầm.
- Không commit `.env`/key. Không `git push` khi chưa được người dùng cho phép. Commit **không** thêm dòng `Co-Authored-By` của AI.
- Xong việc = `npm test` xanh + bằng chứng đã lưu trong `docs/proof/phase-N/` (hook Stop sẽ chặn nếu test đỏ).
