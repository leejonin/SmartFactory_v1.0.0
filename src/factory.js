import { LAYERS } from './layout.js';
import { Simulation } from './simulation.js';
import { encodeRegion, decodeRegion } from './qr.js';

/** 동일 운영 로직의 네 레이어를 독립 실행하고 기존 화면에 합계를 제공한다. SW_Browser_Logistics_001 */
export class FactorySimulation {
  /** 레이어당 같은 AGV 대수를 사용하고 QR 이미지는 목적지마다 한 번 생성한다. */
  constructor({agvCount=3, random=Math.random}={}) {
    this.qrImages=LAYERS.map(layer=>layer.regions.map(encodeRegion));
    this.layers=LAYERS.map((layer,i)=>({...layer,simulation:new Simulation({agvCount,random,regions:layer.regions,
      decode:b=>decodeRegion(this.qrImages[i][layer.regions.indexOf(b.destination)],layer.regions)})}));
  }
  /** 네 레이어에 동일한 고정 시간 단계를 적용한다. */
  step(dt){for(const layer of this.layers)layer.simulation.step(dt);}
  /** 모든 레이어의 진행·집계를 초기화한다. */
  reset(){for(const layer of this.layers)layer.simulation.reset();}
  /** 모든 레이어에 같은 N대를 적용한다. */
  setAgvCount(count){for(const layer of this.layers)layer.simulation.setAgvCount(count);}
  /** 판독 실패 상자만 기존 규칙대로 다시 읽는다. */
  retryScan(){for(const layer of this.layers)layer.simulation.retryScan();}
  /** 동기 실행 중인 전체 모의 시간. */
  get time(){return this.layers[0].simulation.time;}
  /** 화면용 활성 상자 합계. 내부 상태는 각 레이어가 소유한다. */
  get boxes(){return this.layers.flatMap(layer=>layer.simulation.boxes);}
  /** L1~L4의 각 도크 순서로 나열한 12개 출하 수량. */
  get delivered(){return this.layers.flatMap(layer=>layer.simulation.delivered);}
  /** 화면에서 레이어를 구분하는 장비 상태. */
  get agvs(){return this.layers.flatMap(layer=>layer.simulation.agvs.map(a=>({...a,layer:layer.id})));}
  /** 최근 판독 결과를 레이어 이름·시각과 함께 전달한다. */
  get lastRead(){return this.layers.flatMap(layer=>layer.simulation.lastRead?[{...layer.simulation.lastRead,layer:layer.id}]:[]).sort((a,b)=>b.time-a.time)[0]||null;}
  /** 서로 같은 상자 번호라도 레이어 이름으로 구분하는 최근 기록. */
  get events(){return this.layers.flatMap(layer=>layer.simulation.events.map(e=>({...e,message:`${layer.id} · ${e.message}`}))).sort((a,b)=>b.time-a.time).slice(0,8);}
}
