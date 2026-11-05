# 키트 상세 화면 구현

- 문서 버전: v0.0.0
- 생성·수정: 2026-11-03 19:35:20 KST
- 기능 ID: SW_Browser_ConveyorKit_001 (관련 SW_Browser_Logistics_001)
- 지시자: 이종인 / 작업자: Claude Opus 5.5 (Claude)
- 목적: 한 공정 컨베이어를 눌러 실제 키트와 같은 모습·동작을 자세히 보게 한다.
- 목표: 키트 1:1 재현 페이지를 만들고, 색별 분류 정확도·게이트 동작을 테스트로 확인한다.
- 환경: Three.js 0.187.0(OrbitControls·GLTFLoader·RoomEnvironment·RoundedBoxGeometry 애드온), Vite 8.3.5. 새 런타임 패키지 없음.
- 계획: ./Info/plan/2026-11-03/192000_컨베이어키트상세화면_plan.md

## 요청
"한 공정 컨베이어 벨트를 누르면 굉장히 디테일하고 실사와 같은 컨베이어 물류라인이 보였으면 한다. 다른 페이지로 넘어가도 된다. 판매 페이지와 최대한 비슷하게, 실제 모델링 파일이 있으면 그걸로." 함께 준 사진: 주황 3D 프린팅 프레임, 알루미늄 프로파일, 녹색 벨트, 노란 원통 센서, 검정 센서 하우징, 파란 서보 2개와 노랑·초록 분류 팔, 초록·노랑·빨강 아크릴 상자, 아크릴 받침 위 아두이노, 전원 스위치 케이블, 색 블록.

## 모델 파일 조사
- 판매 페이지(smartstore.naver.com): 작업 환경에서 접속 차단, 내용 미확인.
- 같은 키트의 공개 STL/STEP: 찾지 못함. 비슷한 Funduino 색 분류기는 구조(바퀴형)가 달라 쓰지 않음. GitHub 색 분류 컨베이어 저장소 2곳(bhanurajpoot04/colour-sorting-conveyor, mrBymax/sortingConveyorBelt)은 3D 파일이 없음.
- 사용: FreeCAD-library(github.com/FreeCAD/FreeCAD-library, CC-BY 3.0)의 STEP 6종을 occt-import-js(github.com/kovacsv/occt-import-js)로 변환. 색별로 합쳐 GLB로 저장(Z-up mm → Y-up m). 변환 내역은 ./Asset/kit-parts/LICENSE.txt.
  - uno.glb 1.35 MB(Freaduino UNO, 70.6×54.7 mm), sg90.glb, sg90_horn.glb, prox_sensor.glb(65 mm), bearing_608.glb, profile_2020.glb.

## 구현
- 새 페이지 ./conveyor.html + ./src/conveyor/. 구조·코드 설명은 ./Info/소프트웨어/컨베이어키트/SW_Browser_ConveyorKit_001/컨베이어키트.md.
- 공장 화면 연결(./src/scene.js·./src/main.js): createScene 네 번째 인자 onConveyorSelect. 왼쪽 버튼을 5 px 미만·0.5초 안에 떼면 클릭으로 보고, 보이는 공정의 컨베이어 그룹(beltGroup.userData.lineId)을 레이캐스트한다. 맞으면 `./conveyor.html?line=L1~L4`로 이동한다. 마우스를 올리면 손가락 커서(0.12초 간격 검사). 끌기는 기존처럼 화면 이동.
- ./vite.config.js: build.rollupOptions.input에 index.html·conveyor.html을 넣어 두 페이지를 함께 빌드.
- 앱 버전 v0.0.18 → v0.0.19(package.json·package-lock.json·두 화면 하단).

## 확인
- npm test(사용자 PC 작업 환경): 27개 통과, 실패 0(새 sorter 테스트 3개 포함).
  - 4개 시드 × 모의 5분: 모든 상자가 자기 색 상자에 도착, 개수 합계 일치, 세 색 모두 1개 이상.
  - 노랑만 투입 시 판독 전 게이트 정지, 초록 게이트 미작동, 도착 후 쉬는 자세 복귀.
  - 2분간 벨트 위 상자 중심 간격 > 블록 폭+2 cm(겹침 없음). 처음 기준(투입 간격-3 cm)은 게이트에 밀린 상자가 뒤로 0.03 m 이상 늦어져 실패했고, 실제 의미인 "겹치지 않음"으로 기준을 바꿨다.
- 작업 환경 Chromium(소프트웨어 렌더러)에서 실제 소스 실행: 부품 6/6 로드, 콘솔 오류 없음. 전체·센서·분류 게이트·제어 보드 시점 화면 확인, 모의 46초 시점에 초록 게이트가 벨트 위로 들어와 초록 블록을 미는 장면 확인.
- 클릭 연결: 공장 화면에서 바닥 짧은 클릭 → 이동 없음, 컨베이어 위 끌기 → 이동 없음, 컨베이어 짧은 클릭 → location.href가 conveyor.html?line=L1로 바뀜.
- 미확인: npm run build(다중 페이지 설정 포함) → SW_Browser_ConveyorKit_Unverified_001. 실제 GPU 프레임 속도·모바일 → SW_Browser_ConveyorKit_Unverified_002. 실제 키트와의 치수 비교 → SW_Browser_ConveyorKit_Unverified_003.

## 추가 확인 — 2026-11-03 19:44 KST (사용자 PC 내장 브라우저, npm run dev)
- 사용자가 켠 개발 서버(http://127.0.0.1:5173)에서 공장 화면 48/48 로드, conveyor.html?line=L1 상세 화면 부품 6/6 로드, 콘솔 오류 없음. 실제 GPU에서 약 165 fps(3초 rAF 측정). 블록이 빨강·노랑 상자로 분류되는 것을 확인.
- 수정: 내장 브라우저 창이 세로로 좁을 때(가로 772 px) 전체 시점이 잘려, view()에서 화면 비율이 1.6보다 작으면 카메라를 1.6/비율만큼 뒤로 빼고, 창 크기가 바뀌면 현재 시점을 다시 맞추도록 했다(./src/conveyor/kit.js).
