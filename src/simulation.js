import { REGIONS } from './qr.js';

export const INLETS = [{ x: -14, z: 0 }, { x: -8, z: -9 }, { x: -3, z: -9 }, { x: 2, z: -9 }];
export const DOCKS = [{ x: 22, z: -7 }, { x: 22, z: 0 }, { x: 22, z: 7 }];
export const GAP = 1.5;
export const AGV_SPEED = 1.2; // m/s: 구간 예약을 유지한 채 이동 속도만 20% 상향.
/** 경로 위 좌표를 속도에 맞춰 이동한다. 목적지에 도착하면 true를 반환한다. */
function advance(object, target, distance) {
  const dx = target.x - object.x, dz = target.z - object.z, length = Math.hypot(dx, dz);
  if (length <= distance) { object.x = target.x; object.z = target.z; return true; }
  object.x += dx / length * distance; object.z += dz / length * distance;
  return false;
}
/** 차체 여유 폭을 포함한 직선 이동 구간의 예약 영역을 계산한다. */
function corridor(from,to=from){return {minX:Math.min(from.x,to.x)-0.98,maxX:Math.max(from.x,to.x)+0.98,minZ:Math.min(from.z,to.z)-0.82,maxZ:Math.max(from.z,to.z)+0.82};}
/** 두 예약 영역이 겹치는지 검사한다. */
function overlaps(a,b){return a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;}
/** 선택한 AGV 군과 네 유입구를 관리하는 결정적 물류 상태기계. SW_Browser_Logistics_001 */
export class Simulation {
  /** @param {{decode: Function, random?: Function, agvCount?: number, regions?: string[]}} options 레이어별 목적지와 기존 공통 운영 설정. */
  constructor({ decode, random = Math.random, agvCount = 1, regions = REGIONS }) {
    this.decode = decode; this.random = random; this.agvCount = agvCount; this.regions = [...regions]; this.reset();
  }
  /** 모든 실행 상태를 초기화한다. 외부 QR 자원은 유지한다. */
  reset() {
    this.time = 0; this.spawnClock = 0; this.nextId = 1; this.ticket = 0;
    this.boxes = []; this.pending = null; this.delivered = [0, 0, 0]; this.created = 0;
    this.events = []; this.lastRead = null;
    this.agvs = Array.from({length:this.agvCount},(_,i)=>({ id:i, x:i===0?10:7, z:i===0?0:4+i*2.6, home:{x:7,z:4+i*2.6}, state:i===0?'ready':'idle', box:null, route:[], timer:0, trips:0 }));
    this.agv = this.agvs[0]; // 기존 단일 장비 참조와 시험 호환.
    this.pickupOwner = 0; this.standbyOwner = null; this.dockOwners = [null,null,null];
    this.agvs.forEach(a=>{a.segment=null;a.waitAge=0;});this.parallelTime=0;
  }
  /** 대수를 변경할 때 진행 중인 운반과 통계를 함께 초기화한다. */
  setAgvCount(count) {
    if(!Number.isInteger(count)||count<1||count>3)throw new RangeError('현재 배치의 AGV 대수는 1~3대입니다.');
    this.agvCount=count;this.reset();
  }
  /** UI 표시용 사건을 최대 8개 보관한다. */
  log(message) { this.events.unshift({ time: this.time, message }); this.events.length = Math.min(8, this.events.length); }
  /** 선택된 입구가 비어 있을 때만 상자를 생성한다. @returns {boolean} 생성 여부 */
  spawn(inlet, destination) {
    const p = INLETS[inlet];
    if (this.boxes.some(b => b.state !== 'loaded' && Math.hypot(b.x - p.x, b.z - p.z) < GAP)) return false;
    this.boxes.push({ id: this.nextId++, inlet, destination, read: null, x: p.x, z: p.z, state: inlet === 0 ? 'main' : 'inbound', ticket: null, timer: 0 });
    this.created++; return true;
  }
  /** 판독 실패 상자만 재시도 상태로 변경한다. */
  retryScan() { for (const b of this.boxes) if (b.state === 'error') { b.state = 'scan'; b.timer = 0; } }
  /** 작은 고정 시간 간격으로 전진한다. 메인 루프와 테스트에서 동일한 함수를 사용한다. */
  step(dt) {
    if (!(dt > 0 && dt <= 0.05)) throw new RangeError('step은 0초 초과 0.05초 이하로 호출해야 합니다.');
    this.time += dt; this.spawnClock += dt;
    if (!this.pending && this.spawnClock >= 3) {
      this.spawnClock -= 3;
      this.pending = { inlet: Math.floor(this.random() * 4), destination: this.regions[Math.floor(this.random() * 3)] };
    }
    if (this.pending && this.spawn(this.pending.inlet, this.pending.destination)) this.pending = null;
    if (this.pending) this.spawnClock = Math.min(this.spawnClock, 3);

    // 앞 상자를 먼저 계산하여 후속 상자의 간격을 보존한다.
    const reserved = this.boxes.find(b => b.state === 'merge' && b.z > -GAP);
    const main = this.boxes.filter(b => !['inbound', 'merge'].includes(b.state) && (b.state !== 'loaded' || this.agvs.some(a=>a.box===b&&a.state==='loading'))).sort((a,b) => b.x-a.x);
    for (let i = 0; i < main.length; i++) {
      const b = main[i];
      if (b.state === 'main') {
        const mergeLimit = reserved && b.x < reserved.x ? reserved.x-GAP : 8;
        b.x = Math.min(8, b.x + 0.5 * dt, i ? main[i-1].x - GAP : 8, mergeLimit);
        if (b.x >= 8) { b.state = 'scan'; b.timer = 0; this.log(`#${b.id} QR 판독 시작`); }
      } else if (b.state === 'scan') {
        b.timer += dt;
        if (b.timer >= 1) {
          b.read = this.decode(b);
          if (this.regions.includes(b.read) && b.read === b.destination) {
            b.state = 'waiting'; this.lastRead = { id: b.id, destination: b.read, time: this.time };
            this.log(`#${b.id} QR 확인 · ${b.read}`);
          } else { b.state = 'error'; this.log(`#${b.id} QR 실패 · 인계 중지`); }
        }
      }
    }
    for (const b of this.boxes.filter(b => b.state === 'inbound').sort((a,b) => b.z-a.z)) {
      const ahead = this.boxes.filter(c => c !== b && c.inlet === b.inlet && ['inbound','merge'].includes(c.state) && c.z > b.z).sort((a,c) => a.z-c.z)[0];
      b.z = Math.min(-GAP, b.z + 0.5*dt, ahead ? ahead.z-GAP : -GAP);
      if (b.z >= -GAP) { b.state = 'merge'; b.ticket = this.ticket++; }
    }
    // 합류는 도착 티켓 순서이며 이동 중인 한 상자의 합류 영역을 예약한다.
    const merging = this.boxes.filter(b => b.state === 'merge').sort((a,b) => a.ticket-b.ticket);
    const first = merging[0];
    if (first) {
      const free = this.boxes.every(b => b === first || b.state === 'loaded' || Math.hypot(b.x-first.x,b.z) >= GAP);
      if (free) {
        first.z = Math.min(0, first.z+0.5*dt);
        if (first.z === 0) { first.state = 'main'; first.ticket = null; }
      }
    }
    this.stepAgv(dt);
  }
  /** 이동 경로를 설정한다. 통로 전체를 잠그지 않고 각 직선 구간을 개별 예약한다. */
  requestTravel(a,state,route) {
    a.state=state;a.route=route;a.segment=null;a.waitAge=0;
  }
  /** 주차 복귀 중인 빈 장비는 안전한 경유점에서 QR 위치로 바로 전환한다. */
  approachRoute(a) {
    if(a.state==='idle')return [{x:12,z:a.z},{x:12,z:2.5},{x:10,z:2.5},{x:10,z:0}];
    // 출하 연결선(-7,0,7)에서 역주행하지 않고 그 사이 횡단선으로 복귀한다.
    if(a.x>=19){const crossZ=a.z<=0?3.5:a.z<=7?10.5:a.z;return [{x:19,z:a.z},{x:19,z:crossZ},{x:13,z:crossZ},{x:13,z:2.5},{x:10,z:2.5},{x:10,z:0}];}
    return [{x:12,z:a.z},{x:12,z:2.5},{x:10,z:2.5},{x:10,z:0}];
  }
  /** 현재 위치부터 경유점까지의 총 이동 길이를 계산해 가까운 빈 장비를 먼저 보낸다. */
  routeLength(a,route) {
    let distance=0,previous=a;for(const p of route){distance+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}return distance;
  }
  /** 가까운 빈 AGV를 QR 인계 또는 바로 옆 대기 위치에 선배차한다. */
  dispatch(state) {
    const candidates=this.agvs.filter(a=>a.state==='idle'||(a.state==='returning'&&!a.segment))
      .map(a=>({a,route:this.approachRoute(a)}));
    if(state==='staging')candidates.forEach(c=>c.route.pop());
    candidates.sort((p,q)=>this.routeLength(p.a,p.route)-this.routeLength(q.a,q.route)||p.a.trips-q.a.trips||p.a.id-q.a.id);
    const chosen=candidates[0];if(!chosen)return;
    const direct=chosen.a.state==='returning';
    if(state==='staging')this.standbyOwner=chosen.a.id;else this.pickupOwner=chosen.a.id;
    this.requestTravel(chosen.a,state,chosen.route);
    if(direct)this.log(`AGV ${chosen.a.id+1} · QR 위치로 바로 복귀`);
  }
  /** 인계 지점·도크·통로 예약으로 다중 AGV를 배차하고 적재 상자를 차체에 결합한다. */
  stepAgv(dt) {
    const waiting=this.boxes.find(b=>b.state==='waiting');
    const hasWork=this.boxes.some(b=>b.state!=='loaded');
    if(this.pickupOwner===null&&hasWork){
      if(this.standbyOwner!==null){
        const staged=this.agvs[this.standbyOwner];
        if(staged.state==='standby'){this.pickupOwner=staged.id;this.standbyOwner=null;this.requestTravel(staged,'approaching',[{x:10,z:0}]);}
      }else this.dispatch('approaching');
    }
    const gate=this.agvs[this.pickupOwner];
    if(this.standbyOwner===null&&hasWork&&gate&&['ready','loading','outbound'].includes(gate.state))this.dispatch('staging');
    for(const a of this.agvs){
      if(a.state==='ready'){
        if(waiting&&this.dockOwners[this.regions.indexOf(waiting.read)]===null){
          a.box=waiting;waiting.state='loaded';a.state='loading';a.timer=0;
          a.dock=this.regions.indexOf(waiting.read);this.dockOwners[a.dock]=a.id;
          this.log(`#${waiting.id} AGV ${a.id+1} 인수`);
        }
      }else if(a.state==='loading'){
        a.timer+=dt;a.box.x=8+2*Math.min(1,a.timer/2);
        if(a.timer>=2){const dock=DOCKS[a.dock];this.requestTravel(a,'outbound',[{x:16,z:0},{x:16,z:dock.z},{x:19,z:dock.z},dock]);}
      }else if(a.state==='unloading'){
        a.timer+=dt;
        if(a.timer>=2){
          const b=a.box;this.delivered[a.dock]++;a.trips++;this.log(`#${b.id} ${b.read} 도크 인도 완료`);
          this.boxes=this.boxes.filter(c=>c!==b);a.box=null;
          const crossings=[0,7,12].filter(z=>z>a.z).map(z=>({x:19,z}));
          this.requestTravel(a,'returning',[{x:19,z:a.z},...crossings,{x:12,z:12},{x:12,z:a.home.z},a.home]);
        }
      }
    }
    let moving=0;
    // 진행 중 예약을 유지하고 오래 기다린 장비부터 다음 구간을 요청한다.
    for(const a of [...this.agvs].sort((a,b)=>(b.waitAge||0)-(a.waitAge||0)||a.id-b.id)){
      if(!a.route.length)continue;
      if(!a.segment){
        const proposed=corridor(a,a.route[0]);
        if(this.agvs.some(b=>b!==a&&overlaps(proposed,b.segment||corridor(b)))){a.waitAge+=dt;continue;}
        a.segment=proposed;a.waitAge=0;
      }
      const oldX=a.x,oldZ=a.z;
      if(advance(a,a.route[0],AGV_SPEED*dt)){a.route.shift();a.segment=null;}
      if(a.x!==oldX||a.z!==oldZ)moving++;
      if(a.state==='outbound'&&a.x>=16&&this.pickupOwner===a.id)this.pickupOwner=null;
      if(a.state==='returning'&&a.x<=19&&this.dockOwners[a.dock]===a.id)this.dockOwners[a.dock]=null;
      if(['approaching','staging'].includes(a.state)&&a.x<=13&&this.dockOwners[a.dock]===a.id)this.dockOwners[a.dock]=null;
      if(!a.route.length){
        if(a.state==='approaching')a.state='ready';
        else if(a.state==='staging')a.state='standby';
        else if(a.state==='outbound'){a.state='unloading';a.timer=0;}
        else a.state='idle';
      }
    }
    if(moving>=2)this.parallelTime+=dt;
    for(const a of this.agvs)if(a.box&&a.state!=='loading'){
      a.box.x=a.x+(a.state==='unloading'?1.9*Math.min(1,a.timer/2):0);a.box.z=a.z;
    }
  }
}

