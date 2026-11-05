# 기능 ID 목록

- 문서 초기 생성·수정 일시: 2026-11-02 (KST)
- 지시자: 이종인
- 작업자: GPT-6 (Codex)
- 버전: v0.0.1

기존 목록·구현이 없는 상태를 확인한 뒤 브라우저에서 실행되는 물류 시뮬레이션에 대표 ID 하나를 부여했습니다. 클래스나 파일마다 중복 ID를 부여하지 않습니다.

| 기능 ID | 영역 / 실행환경 / 영문중분류 | 중분류명 대응 | 기능·책임 | 관련 ID | 상태 |
|---|---|---|---|---|---|
| SW_Browser_Logistics_001 | SW / Browser / Logistics | 물류시뮬레이션 / Logistics | 한 공장 4라인·16유입구·4QR·다중 AGV·12도크·3D 관찰 통합 | 없음 | 구현 완료, 외형 사용자 검토 남음 |

- 코드: `./src/main.js`, `simulation.js`, `qr.js`, `scene.js` (모두 동일 src 폴더).
- 문서: `./Info/소프트웨어/물류시뮬레이션/SW_Browser_Logistics_001/물류시뮬레이션.md`
- 이전 ID: 해당 없음.

## 2026-11-03 19:35:20 KST 추가 — 지시자: 이종인 / 작업자: Claude Opus 5.5 (Claude)

| 기능 ID | 영역 / 실행환경 / 영문중분류 | 중분류명 대응 | 기능·책임 | 관련 ID | 상태 |
|---|---|---|---|---|---|
| SW_Browser_ConveyorKit_001 | SW / Browser / ConveyorKit | 컨베이어키트 / ConveyorKit | 공정 컨베이어 상세 화면: 공두이노 DIY 컨베이어 색상 분류 키트 1:1 재현과 분류 동작 | SW_Browser_Logistics_001 | 구현 완료, 빌드·실물 치수 미확인 |

- 코드: ./conveyor.html, ./src/conveyor/sorter.js, kit.js, main.js, style.css. 테스트 ./tests/sorter.test.js. 에셋 ./Asset/kit-parts/.
- 문서: ./Info/소프트웨어/컨베이어키트/SW_Browser_ConveyorKit_001/컨베이어키트.md
- 이전 ID: 해당 없음.
