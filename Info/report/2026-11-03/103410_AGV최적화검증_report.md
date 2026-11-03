# AGV 경로·픽업 최적화 검증

- 버전: v0.0.1
- 작성·수정: 2026-11-03 10:34:10 KST
- 지시자: 이종인
- 작업자: GPT-6 (Codex)
- 기능 ID: SW_Browser_Logistics_001
- 관련 기능 ID: 없음
- 기술 환경: ./Info/기술_환경.md

## 목적·범위
컨베이어를 변경하지 않고 네 AGV 개선을 검증한다.

## 핵심 결과
3대 평균 출하 96.8→125.8개, 30.0% 증가. 최대 대기열은 모든 조건에서 줄지 않으며 병목 완전 제거 아님.

## 상세 내용·근거
1. 도크 출구를 Z+2.5m로 분리하고 빈 AGV를 픽업 옆으로 직접 복귀시킨다. 도크가 비면 대기장 우회 없이 직행하며 사용 중이면 도크별 (19, 도크 Z-2.5)의 한 자리를 먼저 예약해 픽업한다.
2. pickupRoute는 현재 구간을 끝까지 보존한다. arrivalTime은 경로 이동시간과 현재 점유의 예상 해제시간을 합한다. 멈춘 차량은 임시 4초 비용이며 정확한 미래 예측이 아니다. dispatch는 빈 주차·복귀 차량 중 추정 도착시간이 짧은 차량을 선택한다. 지정 차량의 구간 경계에서 선대기 차량이 이미 도착했거나 ETA가 1초 이상 빠르면 역할을 교환한다. 무제한 경로 탐색이나 임의 차량 교체는 아니다.
3. dockWaitOwners는 도크별 대기 한 자리를 픽업 시점부터 예약한다. dockOwners와 분리하여 도크 사용 중에도 선픽업이 가능하다. 도크 진입 차량이 X=21.1을 지나면 대기 자리를 해제하고, 빈 차량이 도크 Z+2.1을 지나면 도크 소유권을 해제한다. 도크가 비면 직접 진입하여 불필요한 우회를 피한다.
4. 이동 중 corridor는 현재 차체부터 남은 경로만 포함하도록 매 단계 축소된다. 출하 통로 X=16 회전점에는 다음 구간(turn)을 함께 확보하고 도착 시 해당 예약을 이어받는다. 다른 차량의 차체·현재 구간·회전 후 구간을 모두 검사한다.

컨베이어 step(dt) 본문은 작업 전 사본과 문자열 동일을 확인했다. 속도·합류·상자 간격·QR 처리, AGV 1.2m/s, 인수·하역 2초는 유지한다. 화면에는 도크 대기 위치와 도크 앞 대기/진입 상태를 추가했다.
npm test 20개 통과. 동일 목적지 3종×15분 연속 출하, 1~3대 30분, 4공정 10분, 실제 QR 픽셀 판독, 상자 보존·충돌 및 교착 검사 포함. 별도 최종 코드로 seed 1~30 각각 3대·15분 운행하여 매 프레임 차체 충돌 없고 후반 7.5분 출하가 8개 초과 증가함을 확인했다. 테스트는 실제 설비 안전 인증이나 모든 입력의 교착 부재 증명이 아니다.

성능 비교는 v0.0.12 로컬 작업 사본과 v0.0.13을 같은 난수 시드(1,27,998,4587,65535), 1/60초, 각 30분, AGV 1·2·3대 조건으로 실행했다. 난수는 seed=(1664525*seed+1013904223)>>>0, 반환 seed/4294967296. 비교용 decode는 목적지를 즉시 반환하며 QR의 모의 판독 1초는 그대로다. 별도 회귀 테스트는 실제 QR 픽셀을 사용한다. wait는 waiting 상자가 존재한 시간의 합(초), emptyMetersPerDelivery는 빈 차 이동거리/완료 수(미완료 운행 거리 포함), maxQueue는 적재 전 상자 최대 수다. 같은 난수열이라도 유입 대기 때문에 실제 생성 시점은 달라질 수 있다.

```json
[
  {
    "count": 1,
    "seed": 1,
    "before": {
      "delivered": 46,
      "wait": 1568,
      "emptyMetersPerDelivery": 23.7,
      "maxQueue": 26
    },
    "after": {
      "delivered": 49,
      "wait": 1560,
      "emptyMetersPerDelivery": 21.4,
      "maxQueue": 26
    }
  },
  {
    "count": 1,
    "seed": 27,
    "before": {
      "delivered": 46,
      "wait": 1562,
      "emptyMetersPerDelivery": 23.6,
      "maxQueue": 31
    },
    "after": {
      "delivered": 48,
      "wait": 1554,
      "emptyMetersPerDelivery": 21.8,
      "maxQueue": 30
    }
  },
  {
    "count": 1,
    "seed": 998,
    "before": {
      "delivered": 46,
      "wait": 1567,
      "emptyMetersPerDelivery": 23.8,
      "maxQueue": 28
    },
    "after": {
      "delivered": 49,
      "wait": 1557,
      "emptyMetersPerDelivery": 21.4,
      "maxQueue": 28
    }
  },
  {
    "count": 1,
    "seed": 4587,
    "before": {
      "delivered": 46,
      "wait": 1568,
      "emptyMetersPerDelivery": 23.7,
      "maxQueue": 27
    },
    "after": {
      "delivered": 48,
      "wait": 1560,
      "emptyMetersPerDelivery": 21.8,
      "maxQueue": 27
    }
  },
  {
    "count": 1,
    "seed": 65535,
    "before": {
      "delivered": 46,
      "wait": 1564,
      "emptyMetersPerDelivery": 23.7,
      "maxQueue": 22
    },
    "after": {
      "delivered": 49,
      "wait": 1556,
      "emptyMetersPerDelivery": 21.4,
      "maxQueue": 22
    }
  },
  {
    "count": 2,
    "seed": 1,
    "before": {
      "delivered": 82,
      "wait": 1428,
      "emptyMetersPerDelivery": 28.7,
      "maxQueue": 26
    },
    "after": {
      "delivered": 90,
      "wait": 1391,
      "emptyMetersPerDelivery": 21.6,
      "maxQueue": 26
    }
  },
  {
    "count": 2,
    "seed": 27,
    "before": {
      "delivered": 81,
      "wait": 1418,
      "emptyMetersPerDelivery": 28.8,
      "maxQueue": 30
    },
    "after": {
      "delivered": 89,
      "wait": 1382,
      "emptyMetersPerDelivery": 21.9,
      "maxQueue": 30
    }
  },
  {
    "count": 2,
    "seed": 998,
    "before": {
      "delivered": 81,
      "wait": 1425,
      "emptyMetersPerDelivery": 28.9,
      "maxQueue": 27
    },
    "after": {
      "delivered": 93,
      "wait": 1380,
      "emptyMetersPerDelivery": 21.3,
      "maxQueue": 29
    }
  },
  {
    "count": 2,
    "seed": 4587,
    "before": {
      "delivered": 82,
      "wait": 1422,
      "emptyMetersPerDelivery": 28,
      "maxQueue": 27
    },
    "after": {
      "delivered": 90,
      "wait": 1387,
      "emptyMetersPerDelivery": 21.6,
      "maxQueue": 28
    }
  },
  {
    "count": 2,
    "seed": 65535,
    "before": {
      "delivered": 82,
      "wait": 1424,
      "emptyMetersPerDelivery": 28.2,
      "maxQueue": 26
    },
    "after": {
      "delivered": 91,
      "wait": 1383,
      "emptyMetersPerDelivery": 21.6,
      "maxQueue": 27
    }
  },
  {
    "count": 3,
    "seed": 1,
    "before": {
      "delivered": 98,
      "wait": 1359,
      "emptyMetersPerDelivery": 33.4,
      "maxQueue": 28
    },
    "after": {
      "delivered": 129,
      "wait": 1235,
      "emptyMetersPerDelivery": 21.5,
      "maxQueue": 29
    }
  },
  {
    "count": 3,
    "seed": 27,
    "before": {
      "delivered": 95,
      "wait": 1365,
      "emptyMetersPerDelivery": 34.5,
      "maxQueue": 30
    },
    "after": {
      "delivered": 126,
      "wait": 1237,
      "emptyMetersPerDelivery": 21.6,
      "maxQueue": 30
    }
  },
  {
    "count": 3,
    "seed": 998,
    "before": {
      "delivered": 98,
      "wait": 1356,
      "emptyMetersPerDelivery": 33.4,
      "maxQueue": 28
    },
    "after": {
      "delivered": 126,
      "wait": 1241,
      "emptyMetersPerDelivery": 21.8,
      "maxQueue": 29
    }
  },
  {
    "count": 3,
    "seed": 4587,
    "before": {
      "delivered": 99,
      "wait": 1351,
      "emptyMetersPerDelivery": 32.4,
      "maxQueue": 31
    },
    "after": {
      "delivered": 128,
      "wait": 1235,
      "emptyMetersPerDelivery": 21.6,
      "maxQueue": 29
    }
  },
  {
    "count": 3,
    "seed": 65535,
    "before": {
      "delivered": 94,
      "wait": 1371,
      "emptyMetersPerDelivery": 34.7,
      "maxQueue": 29
    },
    "after": {
      "delivered": 120,
      "wait": 1266,
      "emptyMetersPerDelivery": 21.9,
      "maxQueue": 27
    }
  }
]
```

## 결론
검증한 조건에서 1·2·3대 모두 출하량 증가. 3대의 이득이 가장 크다. 순간 상자 대기는 계속 존재한다.

## 미확인·후속
전체 브라우저·실제 설비 치수·장시간 실제 환경은 기존 미확인 범위다. 사용자 피드백으로 후속 판단한다.

변경 전 source SHA256: e7f618cfcf4c07b306a7ce5880b7cb5f83f7e5a5ac501bec2822cb476e4ffb58
변경 후 source SHA256: 779371a497646a88bdf4ec5f5e6dd9baaf627488345fa6ebca9490991d12f30e


최종 브라우저 검증: Codex 내장 브라우저에서 v0.0.13 로드, 장비 16/16, 한 공정·3대 AGV, 새 도크 대기 위치와 도크 진입 상태 확인. 5배속으로 모의시간 8분13초까지 운행하여 출하32(10/6/16), 활성21 확인 후 1배속 복원. 콘솔 전체 로그·장시간 실제 시간 시험은 별도 미확인. 이전 종료된 개발 서버를 동일 로컬 포트에서 재시작했다. 화면: ./Info/소프트웨어/물류시뮬레이션/SW_Browser_Logistics_001/day/2026-11-03_AGV최적화_화면.png
최종 빌드 성공: JS822.73kB/gzip225.30kB, 기존 청크 크기 경고 유지.
