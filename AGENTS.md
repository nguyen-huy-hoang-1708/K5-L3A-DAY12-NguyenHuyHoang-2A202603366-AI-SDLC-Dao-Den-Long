# AGENTS.md — Đảo Đèn Lồng

Game 3D web (Three.js) + headless Node theo **Test Contract v1.0**. Yêu cầu gốc: lab board (tab Phase N). Giả định & tiêu chí nghiệm thu: `docs/notes/phase-N.md`.

## Lệnh
- Test (contract + unit + scenario + determinism): `npm test`
- Headless: `node headless/run.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chạy game: `node tools/serve.js` → http://localhost:8080/web/
- Bằng chứng headless: `node tools/proof.js phase-N` · Playtest client thật: `node tools/playtest.js --mode win|lose --out docs/proof/phase-N/playtest`
- Kiểm tra test không "luôn xanh": `tools/mutation-check.sh`
- Sáng tạo không đổi output headless: `tools/creative-check.sh` (so với tag `ui-classic`)

## Kiến trúc
- `src/sim.js`: **toàn bộ luật chơi**, thuần, tất định (mulberry32(seed)). Không `Math.random`/`Date`/DOM ở đây.
- `src/inputs.js`: đọc file inputs. `headless/run.js`: CLI contract. `web/main.js`: chỉ hiển thị + bàn phím → input contract.
- Số tuning nằm ở `TUNING` trong `src/sim.js` và **phải trùng** `game.contract.json` (`tools/check-contract.js` chặn lệch).

## Quy tắc
- Đổi luật → sửa `src/sim.js`, thêm/sửa test trong `tests/`, cập nhật `docs/notes/phase-N.md` (giả định) cùng commit.
- Không bịa yêu cầu: dẫn nguyên văn ticket khi không chắc; chỗ mơ hồ ghi thành giả định.
- Sáng tạo thêm chỉ ở `web/` (hiển thị/âm thanh) hoặc tắt trong headless; không làm đổi output JSONL.
- Test cũ bị luật mới thay thế: sửa hoặc xoá **kèm lý do** trong notes, không skip âm thầm.
- Không commit `.env`/key. Không `git push` khi chưa được người dùng cho phép.
- Xong việc = `npm test` xanh + bằng chứng đã lưu trong `docs/proof/phase-N/` (hook Stop sẽ chặn nếu test đỏ).
