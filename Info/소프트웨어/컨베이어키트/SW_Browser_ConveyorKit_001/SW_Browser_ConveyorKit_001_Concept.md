# SW_Browser_ConveyorKit_001 개념

- 기능 ID: SW_Browser_ConveyorKit_001
- 개념명: 컨베이어 색상 분류 키트 디지털 트윈(상세 화면)
- 지시자: 이종인 / 작업자: Claude Opus 5.5 (Claude)
- 작성·수정: 2026-11-03 19:35:20 KST
- 관련 개념: SW_Browser_Logistics_001(공장 전체 물류 흐름). 공장 화면의 한 공정 컨베이어 = 이 키트 한 대.

`c`는 상자, `x(c)`는 진행 위치, `col(c)`는 실제 색, `read(c)`는 판독 색, `G[g]`는 색 g 게이트의 작동 정도(0~1), `bin(c)`는 도착한 상자다.

```text
x(c) >= sensorX  => read(c) := col(c)            (0.25초 판독 후)
read(c) = g, g in {yellow, green}, tip(g)-0.05 < x(c) < pivot(g)  => G[g] -> 1
read(c) = g and |z(c)| > beltHalf  => bin(c) := g, G[g] -> 0
read(c) = red and x(c) > L        => bin(c) := red
forall c in binned: bin(c) = col(c)               (테스트로 확인)
```
