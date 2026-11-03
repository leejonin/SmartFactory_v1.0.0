import { REGIONS } from './qr.js';

export const INLETS = [{ x: -14, z: 0 }, { x: -8, z: -9 }, { x: -3, z: -9 }, { x: 2, z: -9 }];
export const DOCKS = [{ x: 22, z: -7 }, { x: 22, z: 0 }, { x: 22, z: 7 }];
export const GAP = 1.5;
export const MAX_AGVS = 12;
/** 12개 주차면을 컨베이어 아래 두 줄에 배치한다. 진출입은 각 열의 빈 통로를 이용한다. */
export function agvHome(i){return {x:7-3*(i%6),z:6+5*Math.floor(i/6)};}
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
  constructor({ decode, random = Math.random, agvCount = 4, regions = REGIONS }) {
    if(!Number.isInteger(agvCount)||agvCount<1||agvCount>MAX_AGVS)throw new RangeError('AGV 대수는 1~12대입니다.');
    this.decode = decode; this.random = random; this.agvCount = agvCount; this.regions = [...regions]; this.reset();
  }
  /** 모든 실행 상태를 초기화한다. 외부 QR 자원은 유지한다. */
  reset() {
    this.time = 0; this.spawnClock = 0; this.nextId = 1; this.ticket = 0;
    this.boxes = []; this.pending = null; this.delivered = [0, 0, 0]; this.created = 0;
    this.events = []; this.lastRead = null;
    this.agvs = Array.from({length:this.agvCount},(_,i)=>({ id:i, x:i===0?10:agvHome(i).x, z:i===0?0:agvHome(i).z, home:agvHome(i), state:i===0?'ready':'idle', box:null, route:[], timer:0, trips:0 }));
    this.agv = this.agvs[0]; // 기존 단일 장비 참조와 시험 호환.
    this.pickupOwner = 0; this.standbyOwner = null; this.dockOwners = [null,null,null]; this.dockWaitOwners=[null,null,null];
    this.agvs.forEach(a=>{a.segment=null;a.turn=null;a.waitAge=0;});this.parallelTime=0;
  }
  /** 대수를 변경할 때 진행 중인 운반과 통계를 함께 초기화한다. */
  setAgvCount(count) {
    if(!Number.isInteger(count)||count<1||count>MAX_AGVS)throw new RangeError('현재 배치의 AGV 대수는 1~12대입니다.');
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
  /** 작은 고정 시간 간격으로 전진한다. 합류 중 예약을 우선하고, 진입 가능한 요청 중 오래된 티켓부터 처리한다. 메인 루프와 테스트에서 동일한 함수를 사용한다. */
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
    // 이동 중인 합류를 먼저 마친다. 아직 진입하지 못한 요청은 다른 빈 합류점을 막지 않는다.
    const merging = this.boxes.filter(b => b.state === 'merge').sort((a,b) => a.ticket-b.ticket);
    const first = reserved || merging.find(candidate=>this.boxes.every(b=>b===candidate||b.state==='loaded'||Math.hypot(b.x-candidate.x,b.z)>=GAP));
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
    a.state=state;a.route=route;a.segment=null;a.turn=null;a.waitAge=0;
  }
  /** 빈 차량의 도크 출구를 분리하고 픽업 옆으로 직접 복귀한다. 도크 입구와 출구를 2.5m씩 분리하며 기존 컨베이어를 통과하지 않는다. */
  approachRoute(a) {
    if(a.state==='idle')return [{x:a.x,z:a.z-2},{x:10,z:a.z-2},{x:10,z:2.5},{x:10,z:0}];
    if(a.x>=19){const exitZ=DOCKS[a.dock].z+2.5;return [{x:22,z:exitZ},{x:13,z:exitZ},{x:13,z:2.5},{x:10,z:2.5},{x:10,z:0}];}
    return [{x:13,z:a.z},{x:13,z:2.5},{x:10,z:2.5},{x:10,z:0}];
  }
  /** 현재 구간을 마친 뒤의 경로를 산출한다. 진행 중인 예약은 바꾸지 않는다.
   * @param {object} a 빈 AGV. @param {string} state 인계 또는 선대기.
   * @returns {object[]} 현재 구간 끝을 포함한 경유점.
   */
  pickupRoute(a,state){
    // 복귀 중 이미 진입한 합류점까지의 경로를 보존하여 역주행을 방지한다.
    const merge=a.route.findIndex(p=>p.x===10&&p.z===2.5);
    if(a.state==='returning'&&merge>=0){
      const route=a.route.slice(0,merge+1);
      if(state!=='staging')route.push({x:10,z:0});
      return route;
    }
    if(a.state==='returning'&&a.x===10&&a.z>=2.5){
      const end=a.segment?a.route[0]:null;
      const route=end?[end,{x:10,z:2.5}]:[{x:10,z:2.5}];
      if(state!=='staging')route.push({x:10,z:0});
      return route;
    }
    const end=a.segment?a.route[0]:null;
    const route=this.approachRoute(end?{...a,...end}:a);
    if(state==='staging')route.pop();
    return end?[end,...route]:route;
  }
  /** 경로 길이와 교차 예약의 해제 예상 시간을 합산한 도착 시간 추정값(초).
   * 정지 차량의 점유에는 4초 비용을 주며 실제 이동은 별도 충돌 검사로 보호한다.
   */
  arrivalTime(a,route){
    let eta=0,from=a;
    for(const to of route){
      const area=corridor(from,to);let delay=0;
      for(const other of this.agvs){
        if(other===a||(!overlaps(area,other.segment||corridor(other))&&!(other.turn&&overlaps(area,other.turn))))continue;
        const clear=other.segment?Math.hypot(other.x-other.route[0].x,other.z-other.route[0].z)/AGV_SPEED:4;
        delay=Math.max(delay,clear-eta);
      }
      eta+=Math.max(0,delay)+Math.hypot(to.x-from.x,to.z-from.z)/AGV_SPEED;from=to;
    }
    return eta;
  }
  /** 현재 위치부터 경유점까지의 총 이동 길이를 계산한다. 경로 비교와 검증에 사용한다. */
  routeLength(a,route) {
    let distance=0,previous=a;for(const p of route){distance+=Math.hypot(p.x-previous.x,p.z-previous.z);previous=p;}return distance;
  }
  /** 예상 도착 시간이 가장 짧은 빈 AGV를 배정하고 진행 중인 구간은 끝까지 보존한다. */
  dispatch(state) {
    const candidates=this.agvs.filter(a=>a.state==='idle'||a.state==='returning')
      .map(a=>({a,route:this.pickupRoute(a,state)}));
    candidates.sort((p,q)=>this.arrivalTime(p.a,p.route)-this.arrivalTime(q.a,q.route)||p.a.trips-q.a.trips||p.a.id-q.a.id);
    const chosen=candidates[0];if(!chosen)return;
    const direct=chosen.a.state==='returning',segment=chosen.a.segment;
    if(state==='staging')this.standbyOwner=chosen.a.id;else this.pickupOwner=chosen.a.id;
    this.requestTravel(chosen.a,state,chosen.route);chosen.a.segment=segment;
    if(direct)this.log(`AGV ${chosen.a.id+1} · QR 위치로 바로 복귀`);
  }
  /** 인계 지점·도크·통로 예약으로 다중 AGV를 배차한다. 동쪽 또는 북쪽으로 2.1m 벗어나면 다음 차량을 진입시킨다.
   * 도크 본자리 확보 시 대기면 예약을 풀고, 선대기 이동의 기존 예약은 유지한다. SW_Browser_Logistics_001
   */
  stepAgv(dt) {
    const waiting=this.boxes.find(b=>b.state==='waiting');
    const hasWork=this.boxes.some(b=>b.state!=='loaded');
    if(this.pickupOwner===null&&hasWork){
      if(this.standbyOwner!==null){
        const staged=this.agvs[this.standbyOwner];
        // 선대기 이동이 끝날 때까지 배차를 보류하지 않고 기존 안전 예약을 유지해 인계 경로를 잇는다.
        if(['standby','staging'].includes(staged.state)){
          this.pickupOwner=staged.id;this.standbyOwner=null;
          staged.state='approaching';staged.route.push({x:10,z:0});
        }
      }else this.dispatch('approaching');
    }
    // 먼저 대기 위치에 도착한 차량을 우선하여 뒤의 지정 차량과 순서가 뒤집히는 것을 막는다.
    const assigned=this.agvs[this.pickupOwner],staged=this.agvs[this.standbyOwner];
    if(assigned?.state==='approaching'&&!assigned.segment&&staged&&
      (staged.state==='standby'||this.arrivalTime(staged,[...staged.route,{x:10,z:0}])+1<this.arrivalTime(assigned,assigned.route))){
      assigned.route.pop();assigned.state=assigned.route.length?'staging':'standby';
      this.standbyOwner=assigned.id;this.pickupOwner=staged.id;
      staged.state='approaching';staged.route.push({x:10,z:0});
    }
    const gate=this.agvs[this.pickupOwner];
    if(this.standbyOwner===null&&hasWork&&gate&&['approaching','ready','loading','outbound','docking'].includes(gate.state))this.dispatch('staging');
    for(const a of this.agvs){
      if(a.state==='ready'){
        if(waiting&&this.dockWaitOwners[this.regions.indexOf(waiting.read)]===null){
          a.box=waiting;waiting.state='loaded';a.state='loading';a.timer=0;
          a.dock=this.regions.indexOf(waiting.read);this.dockWaitOwners[a.dock]=a.id;
          this.log(`#${waiting.id} AGV ${a.id+1} 인수`);
        }
      }else if(a.state==='loading'){
        a.timer+=dt;a.box.x=8+2*Math.min(1,a.timer/2);
        if(a.timer>=2){
          const dock=DOCKS[a.dock];
          if(this.dockOwners[a.dock]===null){
            // 빈 도크에는 대기장 우회 없이 직접 진입한다.
            this.dockOwners[a.dock]=a.id;
            // 도크 본자리를 확보한 차량은 대기면까지 중복 점유하지 않는다.
            if(this.dockWaitOwners[a.dock]===a.id)this.dockWaitOwners[a.dock]=null;
            // 위쪽 도크는 픽업 오른편에서 북쪽으로 바로 출발해 중앙 복귀 교차로를 피한다.
            this.requestTravel(a,'docking',a.dock===0
              ?[{x:10,z:-2.1},{x:10,z:dock.z},{x:19,z:dock.z},dock]
              :[{x:12.1,z:0},{x:16,z:0},{x:16,z:dock.z},{x:19,z:dock.z},dock]);
          }else this.requestTravel(a,'outbound',a.dock===0
            ?[{x:10,z:-2.1},{x:10,z:dock.z-2.5},{x:19,z:dock.z-2.5}]
            :[{x:12.1,z:0},{x:16,z:0},{x:16,z:dock.z-2.5},{x:19,z:dock.z-2.5}]);
        }
      }else if(a.state==='dockWaiting'){
        if(this.dockOwners[a.dock]===null){
          this.dockOwners[a.dock]=a.id;
          if(this.dockWaitOwners[a.dock]===a.id)this.dockWaitOwners[a.dock]=null;
          const dock=DOCKS[a.dock];this.requestTravel(a,'docking',[{x:22,z:dock.z-2.5},dock]);
        }
      }else if(a.state==='unloading'){
        a.timer+=dt;
        if(a.timer>=2){
          const b=a.box;this.delivered[a.dock]++;a.trips++;this.log(`#${b.id} ${b.read} 도크 인도 완료`);
          this.boxes=this.boxes.filter(c=>c!==b);a.box=null;
          this.requestTravel(a,'returning',[{x:22,z:a.z+2.5},{x:13,z:a.z+2.5},{x:13,z:2.5},{x:10,z:2.5},{x:10,z:a.home.z-2},{x:a.home.x,z:a.home.z-2},a.home]);
        }
      }
    }
    let moving=0;
    // 진행 중 예약을 유지하고 오래 기다린 장비부터 다음 구간을 요청한다.
    for(const a of [...this.agvs].sort((a,b)=>(b.waitAge||0)-(a.waitAge||0)||a.id-b.id)){
      if(!a.route.length)continue;
      if(!a.segment){
        const proposed=corridor(a,a.route[0]);
        // 출하 세로 통로의 회전점에는 다음 구간의 출구까지 확보한 뒤 들어간다.
        const turn=['outbound','docking'].includes(a.state)&&a.route[0].x===16&&a.route[1]?corridor(a.route[0],a.route[1]):null;
        const blocked=this.agvs.some(b=>b!==a&&[b.segment||corridor(b),b.turn].filter(Boolean)
          .some(area=>overlaps(proposed,area)||(turn&&overlaps(turn,area))));
        if(blocked){a.waitAge+=dt;continue;}
        a.segment=proposed;a.turn=turn;a.waitAge=0;
      }
      const oldX=a.x,oldZ=a.z;
      if(advance(a,a.route[0],AGV_SPEED*dt)){a.route.shift();a.segment=a.turn;a.turn=null;}
      else a.segment=corridor(a,a.route[0]); // 지나간 구간을 해제하고 차체와 남은 직선만 예약한다.
      if(a.x!==oldX||a.z!==oldZ)moving++;
      if(['outbound','docking'].includes(a.state)&&(a.x>=12.1||a.z<=-2.1)&&this.pickupOwner===a.id)this.pickupOwner=null;
      if(a.state==='docking'&&a.x>=21.1&&this.dockWaitOwners[a.dock]===a.id)this.dockWaitOwners[a.dock]=null;
      if(a.box===null&&a.dock!==undefined&&a.z>=DOCKS[a.dock].z+2.1&&this.dockOwners[a.dock]===a.id)this.dockOwners[a.dock]=null;
      if(!a.route.length){
        if(a.state==='approaching')a.state='ready';
        else if(a.state==='staging')a.state='standby';
        else if(a.state==='outbound')a.state='dockWaiting';
        else if(a.state==='docking'){a.state='unloading';a.timer=0;}
        else a.state='idle';
      }
    }
    if(moving>=2)this.parallelTime+=dt;
    for(const a of this.agvs)if(a.box&&a.state!=='loading'){
      a.box.x=a.x+(a.state==='unloading'?1.9*Math.min(1,a.timer/2):0);a.box.z=a.z;
    }
  }
}

