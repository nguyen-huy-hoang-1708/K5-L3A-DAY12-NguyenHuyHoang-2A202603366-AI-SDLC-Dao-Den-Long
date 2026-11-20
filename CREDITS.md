# CREDITS

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Three.js r160 (`web/vendor/three.module.min.js`) | https://threejs.org — npm `three@0.160.0` | MIT, xem `web/vendor/three.LICENSE` |
| Three.js post-processing (`web/vendor/jsm/`: EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, MaskPass, Pass, CopyShader, LuminosityHighPassShader, OutputShader) | npm `three@0.160.0` `examples/jsm` | MIT, xem `web/vendor/three.LICENSE` |
| Font chữ Noto Serif, Cormorant Garamond (tải từ Google Fonts khi có mạng; offline dùng font serif hệ thống) | Google Fonts | SIL Open Font License 1.1 |
| Texture trận pháp, mây, cánh hoa, quầng sáng | Vẽ bằng Canvas 2D lúc chạy trong `web/main.js` | MIT (repo này) |
| Mô hình 3D (Mây, đèn, Bóng Mực, đảo, cây, đá, bảo tháp, núi) | Tự dựng từ hình khối cơ bản của Three.js trong `web/main.js` | MIT (repo này) |
| Âm thanh | Tổng hợp lúc chạy bằng WebAudio (oscillator), không có file âm thanh | MIT (repo này) |
| Nhân vật & bối cảnh (Mây, Bóng Mực, Đảo Đèn Lồng) | Bản gốc của Day 12 AI SDLC Lab | Theo lab |
| Code, test, tài liệu | Viết với trợ giúp của Claude Code (Anthropic, model Claude Opus 5.5), được review và kiểm chứng bằng test | MIT (repo này) |
| Video demo `docs/demo/demo.mp4`, ảnh `docs/media/*` | Quay/chụp từ game chạy thật bằng Chrome headless (`tools/make-demo.js`), mã hóa bằng ffmpeg | MIT (repo này) |
| Nhân vật Ông Đăng, lời thoại | Tự viết (với trợ giúp của Claude) | MIT (repo này) |
| Công cụ dùng khi phát triển (không phân phối) | Node.js, Google Chrome (CDP), ffmpeg, git, GitHub Actions | Theo giấy phép của từng công cụ |

Không dùng hình ảnh, âm thanh hay mô hình từ nguồn ngoài nào khác.
