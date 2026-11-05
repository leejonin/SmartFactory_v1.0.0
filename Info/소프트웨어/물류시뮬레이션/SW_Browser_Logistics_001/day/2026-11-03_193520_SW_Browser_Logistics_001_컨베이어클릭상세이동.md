# 컨베이어 클릭 → 상세 화면 이동

- 문서 버전: v0.0.0
- 생성·수정: 2026-11-03 19:35:20 KST
- 기능 ID: SW_Browser_Logistics_001 (관련 SW_Browser_ConveyorKit_001)
- 지시자: 이종인 / 작업자: Claude Opus 5.5 (Claude)
- 목적: 공장 화면 사용자가 한 공정 컨베이어를 눌러 상세 장비 화면으로 바로 갈 수 있게 한다.
- 목표: 컨베이어 클릭(끌기와 구분)을 구현하고 해당 공정 id로 상세 페이지에 이동함을 확인한다.

./src/scene.js: createScene(container,qrImages,onAssetStatus,onConveyorSelect). 각 공정 beltGroup에 userData.lineId를 붙이고 buildLayer가 beltGroup을 반환한다.
```js
    renderer.domElement.addEventListener('pointerup',e=>{if(!down||e.button!==0)return;const short=Math.hypot(e.clientX-down.x,e.clientY-down.y)<5&&performance.now()-down.t<500;down=null;if(!short)return;const id=conveyorAt(e);if(id)onConveyorSelect(id);});
```
./src/main.js: `id=>{location.href=`./conveyor.html?line=${id}`;}`를 넘기고 안내 문구에 "컨베이어 클릭 시 상세"를 더했다. 앱 v0.0.19.

확인: 바닥 클릭·컨베이어 위 끌기는 이동하지 않고, 컨베이어 짧은 클릭은 conveyor.html?line=L1로 이동(작업 환경 Chromium, 실제 마우스 이벤트). npm test 27개 통과. 빌드는 미확인(SW_Browser_Logistics_Unverified_009).
