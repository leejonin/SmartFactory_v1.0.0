# 왼쪽 드래그 화면 이동

- 문서 버전: v0.0.0
- 생성·수정: 2026-11-03 19:19:14 KST
- 기능 ID: SW_Browser_Logistics_001
- 지시자: 이종인 / 작업자: Claude Opus 5.5 (Claude)
- 목적: 3D 공장을 둘러보는 사용자가 원하는 위치로 쉽게 화면을 옮길 수 있게 한다.
- 목표: 왼쪽 드래그로 화면을 끌어 이동하는 기능을 구현하고, 드래그 방향대로 장면이 따라오며 시점 각도는 바뀌지 않음을 확인한다.
- 환경: Three.js 0.187.0 OrbitControls, 패키지 변경 없음.

## 요청
사용자: "마우스를 왼쪽 드래그해서 끌기하면 왼쪽으로 가고 그런 거" — 기존에는 왼쪽 드래그가 회전, 오른쪽 드래그가 이동이었다.

## 변경
./src/scene.js OrbitControls 생성 직후:
```js
  // 지도처럼 왼쪽 드래그로 바닥을 따라 화면을 끌어 이동하고, 오른쪽 드래그로 회전한다. 터치는 한 손가락 이동, 두 손가락 확대·회전.
  controls.mouseButtons={LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE};controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};controls.screenSpacePanning=false;controls.update();
```
- mouseButtons: 왼쪽=이동(PAN), 가운데=확대(DOLLY), 오른쪽=회전(ROTATE).
- screenSpacePanning=false: 화면 위·아래로 끌면 하늘·땅 방향이 아니라 바닥을 따라 앞·뒤로 움직인다. 시점 높이(target y=0)는 유지된다.
- 화면 안내 문구(./src/main.js)와 README 화면 조작을 '드래그 이동 · 휠 확대 · 오른쪽 드래그 회전'으로 바꿨다. 앱 버전 v0.0.17 → v0.0.18.
- 이동 범위 제한은 넣지 않았다. 멀리 이동했을 때는 탑뷰·QR 뷰·AGV 뷰 버튼으로 기준 시점에 돌아온다.

## 확인
- npm test: 24개 통과, 실패 0.
- 작업 환경 Chromium에서 실제 마우스 이벤트로 확인(시작 target [6,0,0.5], 극각 0.793, 방위각 0.607, 거리 99.21):
  - 왼쪽 드래그 ←300px: target [29.08,0,-15.53], 극각·방위각·거리 변화 없음 → 장면이 마우스를 따라 왼쪽으로 끌림.
  - 왼쪽 드래그 ↑200px: target [40.54,0,-0.67], 높이 0 유지 → 바닥을 따라 이동.
  - 오른쪽 드래그 ←300px: 방위각 0.607 → 2.925 → 회전.
- 실제 터치 기기 동작은 미확인(SW_Browser_Logistics_Unverified_003과 같은 범위). npm run build는 여전히 미확인(SW_Browser_Logistics_Unverified_009).
