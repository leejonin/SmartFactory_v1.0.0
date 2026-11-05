# Git 반영과 GitHub Pages 재배포

- 문서 초기 생성 일시: 2026-11-05 18:46:27 (KST)
- 문서 수정 일시: 2026-11-05 18:46:27 (KST)
- 작업 일시: 2026-11-05 18:43:23 ~ 18:46:27 (KST)
- 기능 ID: SW_Browser_Logistics_001
- 관련 기능 ID: SW_Browser_ConveyorKit_001
- 지시자: 이종인
- 작업자: Grok 4.7 — 변경 커밋, main 푸시, Pages 재배포 확인

## 목적

개발자의 최신 공장 장면과 컨베이어 상세 화면을 원격 저장소에 올려, 브라우저 주소에서 다시 볼 수 있게 한다.

## 목표

로컬에 모여 있던 장면·키트 변경을 main에 반영하고, GitHub Pages 배포가 성공한 뒤 공장 화면과 컨베이어 상세 주소가 실제로 열리는지 확인한다.

## 개요

이미 스테이징되어 있던 현업형 창고 장면, 공정 컨베이어 상세 화면, 관련 문서 42개 파일을 한 커밋으로 올렸다. main 푸시가 `.github/workflows/pages.yml`의 배포를 시작했고, 빌드와 배포가 성공했다.

## 용어

| 용어 | 의미 |
|---|---|
| main | 배포 워크플로가 감시하는 기본 브랜치 |
| Pages | 빌드 결과 `dist/`를 정적 사이트로 올리는 GitHub 배포 |
| 상대 경로 | `vite.config.js`의 `base: './'`가 만드는 `./assets/...` 주소 |

## 수정 전후

- 변경 전: 로컬 main이 origin/main의 `5be745b`와 같고, 장면·키트 변경은 커밋 전 스테이징 상태였다.
- 변경 후: `17afd61`이 origin/main에 반영되었다. 커밋 메시지: 현업형 창고 장면과 공정 컨베이어 상세 화면을 배포 대상에 포함한다.
- 변경 이유: 최신 화면을 기존 배포 주소에 다시 올리기 위해서다.
- 관련 파일: `src/scene.js`, `src/main.js`, `src/conveyor/`, `conveyor.html`, `vite.config.js`, `Asset/aws-warehouse/`, `Asset/kit-parts/`, `Info/` 문서, `README.md`

원격 저장소 `leejonin/SmartFactory_v1.1.0`의 공개 설정은 Public이다. 재배포 대상이 기존 Pages 주소이므로 그 공개 원격의 main에 푸시했다. 커밋할 텍스트에서 Windows 절대 경로는 찾지 못했다.

## 확인 방법과 결과

로컬에서 푸시 전에 확인했다.

- `npm test`: 27개 통과, 실패 0개. 소요 약 13초.
- `npm run build`: 통과. `dist/index.html`, `dist/conveyor.html`이 생성되었다. 500kB를 넘는 청크 경고는 남았다. `GLTFLoader` 청크 678.13kB, gzip 170.14kB.

원격 배포:

- 워크플로: GitHub Pages 배포
- 실행: https://github.com/leejonin/SmartFactory_v1.1.0/actions/runs/42004709657
- 결과: completed / success. build 21초, deploy 11초.
- 빌드 로그의 안내: `ubuntu-latest`가 Ubuntu 26으로 바뀐다는 주석이 있었다. 이번 실행은 실패하지 않았다.

접속 확인. 시각은 응답 헤더 기준 2026-11-05 09:44 UTC이며, Last-Modified는 09:43:57 UTC다.

| 주소 | 결과 |
|---|---|
| https://leejonin.github.io/SmartFactory_v1.1.0/ | HTTP 200. 제목 FLOW / 공장 물류 시뮬레이션 |
| https://leejonin.github.io/SmartFactory_v1.1.0/conveyor.html | HTTP 200. 제목 컨베이어 상세 · FLOW |
| `./assets/main-DO_HQbyw.js` | HTTP 200 |
| `./assets/conveyor-vsF6JzWz.js` | HTTP 200 |
| `./assets/GLTFLoader-8GqW2Fjj.js` | HTTP 200 |
| `./assets/GLTFLoader-C814Azh4.css` | HTTP 200 |
| `./assets/conveyor-CboSMusQ.css` | HTTP 200 |

브라우저에서 공장 화면은 장비 48/48 준비 완료, 시뮬레이션 실행 중, 이송 중 6상자를 표시했다. `conveyor.html?line=L1`은 실측 부품 모델 6/6 준비 완료와 분류 현황 화면을 표시했다. 3D 장면이 캔버스에 그려진 것까지 확인했다. 저사양 GPU, 여러 브라우저, 실제 터치 입력은 이번 확인에 포함하지 않았다.

## 구현 연결

`pages.yml`은 main 푸시 때 `npm ci`, `npm test`, `npm run build` 후 `dist/`를 Pages에 올린다. 이번 커밋의 `vite.config.js`는 `base: './'`이고, 공장 페이지와 컨베이어 페이지를 함께 빌드한다. 배포된 HTML의 스크립트 주소는 `./assets/`로 시작한다.

## 기술

로컬 확인: Node.js로 `npm test`, `npm run build`. 패키지 버전은 `package.json`의 Vite 8.3.5, 앱 버전 v0.0.19. CI는 `pages.yml`의 Node.js 24, ubuntu-latest. 정확한 로컬 Node 패치 버전은 이번 명령 출력에서 다시 출력하지 않아 미확인이며, 기존 `Info/기술_환경.md` 기록을 유지한다.

## 남아 있는 문제

이번 푸시와 재배포에서 새로 확인된 실행 버그는 없다. 기존 번들 크기 경고는 유지된다. README의 base 설명은 `/SmartFactory_v1.1.0/`로 남아 있고, 현재 `vite.config.js`와 배포 HTML은 `./`를 쓴다. 사이트 접속은 상대 경로로 성공했으므로 이번 배포 실패는 아니다.
