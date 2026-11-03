# README 정리와 전체 프로젝트 Git 반영 준비

- 문서 버전: v0.0.1
- 최초 생성·수정·작업 일시: 2026-11-02 03:39:17 (KST)
- 기능 ID: SW_Browser_Logistics_001 / 관련 기능 ID: 없음
- 지시자: 이종인
- 작업자: GPT-6 (Codex) — 문서 작성·검증·Git 준비

## 개요와 용어

사용자 요청에 따라 실제 구현에 맞는 한국어 README를 정리하고 프로젝트 전체를 지정 GitHub 저장소에 반영할 준비를 수행했다. AGV는 자동 운반 차량, 레이어는 같은 바닥에 놓인 독립 물류 라인, push는 로컬 커밋을 원격에 전송하는 작업이다.

## 변경 전후와 실제 코드

변경 전 README에는 초기 단일 라인 설명과 이후 4라인 확장 기록이 누적되어 있었다. 변경 후 현재 4라인 구조·목적·실행 방법·기술 버전·QR 방식·제약·소스 구성·검증 결과를 통합했다. README 문서 버전만 v0.0.11로 올리고 앱 v0.0.10은 유지했다. 소스·테스트·설정·원본 에셋은 수정하지 않았다.

코드 근거는 ./src/factory.js의 다음 실제 구현이다.

```javascript
step(dt){for(const layer of this.layers)layer.simulation.step(dt);}
```

main.js가 1/60초 간격으로 FactorySimulation.step을 호출하고, 이 메서드가 각 라인의 Simulation.step에 같은 dt를 전달한다. 각 Simulation은 상자·판독·AGV·도크 집계를 갱신하고 scene.js가 그 상태를 화면에 반영한다. README에는 해당 고정 단계 루프를 발췌했다. 신규 기능 구현은 없다.

## 확인 방법과 결과

- ForAgents v0.0.20 및 ForAgentsConcept v0.0.8 확인. 프로젝트 내부 및 확인한 상위 경로에서 AGENTS.md 파일은 발견되지 않았으며 대화로 제공한 지침을 적용했다.
- package.json·잠금 파일·소스·테스트·기존 Info 기록 대조.
- Node.js v24.18.0, npm 11.16.0, Vite 8.3.5, Three.js 0.187.0, qrcode 1.5.4, jsqr 1.4.0 확인. 공통 환경은 ./Info/기술_환경.md 참조.
- npm test: 13개 통과, 실패 0개. 네 라인 10분 도크별 인도 [5,13,14,9,15,9,14,8,8,7,9,15].
- npm run build: 성공. JS 819.55kB(gzip 224.43kB), 기존 500kB 청크 경고 재확인.
- GLB 4개 asset.copyright의 Innerscene Corp / CC0 1.0 Universal 표시 확인.
- 업로드 후보 텍스트에 개인키·주요 토큰 형식·비밀번호/API 키 할당 패턴 검색 결과 탐지 없음. 완전한 비밀값 부재 보증은 아님. 기존 이미지와 GLB는 프로젝트 자료로 유지한다.

## Git 반영 범위와 보류

작업 전 로컬 Git 저장소가 없었다. 지정 원격 https://github.com/leejonin/SmartFactory_v1.0.0.git 의 main에는 README만 포함한 초기 커밋 69fa91c2c34bd2f52509e48b135ffe973e0ace57이 있었다. 로컬 저장소를 초기화하고 원격 이력을 가져와 파일을 덮어쓰지 않는 mixed reset으로 연결했다. 기존 원격 커밋 작성자 이메일을 로컬 Git 설정에 사용했다.

반영 대상: . 아래 src, tests, Asset, Info 전체와 index.html, package.json, package-lock.json, .gitignore, README.md. 기존 작업별 과거 소스 스냅샷은 없으므로 과거 작업을 재구성하지 않고 현재 전체 프로젝트 상태를 한 커밋으로 준비한다. 기존 day와 plan은 원문 보존한다.

제외: node_modules(설치 의존성), dist(재생성 가능한 빌드), .vite(캐시). 기존 .gitignore 유지. 원격 API가 visibility=public을 반환했으므로 ForAgents 4.8에 따라 push는 수행하지 않는다. 사용자의 Private 전환 또는 공개 push에 대한 명시적 예외 지시가 필요하다. 공개 설정을 임의 변경하지 않았다.

이번 기록을 포함하면 당일 day가 5개이므로 자동 반영 조건도 충족하지만 Private 확인 조건이 우선한다. 시작 시 기존 4개 기록은 모두 당일 생성이며 24시간 미만이었다. 수동 전체 반영 요청도 있으므로 최종 범위는 전체 프로젝트이다.

## 남은 항목

- SW_Browser_Logistics_Unresolved_001: 기존 번들 경고, 성능 최적화는 요청 범위 밖.
- SW_Browser_Logistics_Unverified_005: 이번 작업에서 브라우저 화면 재실행과 새 환경 npm ci는 수행하지 않음. 기존 화면 검증 이력을 새 실행 결과로 주장하지 않음.
- SW_Browser_Logistics_Unresolved_002: Public 원격으로 인한 push 보류. 기능 코드의 실행 버그가 아닌 프로젝트 전달 상태이다.
- 기존 외형·스케치·기기 성능 미확인 001~003은 유지.

별도 계획 문서는 작성하지 않았다. 문제 현황은 ./Info/소프트웨어/물류시뮬레이션/SW_Browser_Logistics_001/problem/문제_목록.md에 연결한다. 커밋 해시와 원격 상태의 최종 확인은 채팅 결과로 전달한다.
