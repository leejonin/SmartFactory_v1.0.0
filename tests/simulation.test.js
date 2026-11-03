import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, GAP, INLETS } from '../src/simulation.js';
import { REGIONS, encodeRegion, decodeRegion } from '../src/qr.js';

const qr=REGIONS.map(encodeRegion);
/** 재현 가능한 난수원을 반환한다. */
function random(seed=341){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
/** 실제 QR 픽셀 판독을 사용하는 시험 인스턴스를 생성한다. */
function simulation(){return new Simulation({agvCount:1,random:random(),decode:b=>decodeRegion(qr[REGIONS.indexOf(b.destination)])});}
/** 지정 초 동안 실제 프레임과 같은 고정 간격으로 실행한다. */
function run(sim,seconds){for(let i=0;i<seconds*60;i++)sim.step(1/60);}

test('세 목적지 실제 QR 이미지 인코딩과 픽셀 판독이 일치한다',()=>{
  REGIONS.forEach((r,i)=>assert.equal(decodeRegion(qr[i]),r));
  const bad={data:new Uint8ClampedArray(100*100*4).fill(255),width:100,height:100};
  assert.equal(decodeRegion(bad),null);
});
test('네 입구 생성 및 점유 위치 생성 거절',()=>{
  const sim=simulation();INLETS.forEach((_,i)=>assert.ok(sim.spawn(i,REGIONS[i%3])));
  INLETS.forEach((_,i)=>assert.equal(sim.spawn(i,REGIONS[0]),false));
  assert.equal(sim.boxes.length,4);
});

test('04 합류가 막혀 있어도 빈 02·03 합류는 진행하고 막힘 해제 후 복구한다',()=>{
  const sim=simulation();sim.spawnClock=-1000;sim.stepAgv=()=>{};
  // 하류 04 합류점은 정지 상자로 막고 가장 오래된 합류 요청을 둔다.
  sim.spawn(0,REGIONS[0]);Object.assign(sim.boxes[0],{x:2,state:'error'});
  for(const inlet of [3,1,2]){
    sim.spawn(inlet,REGIONS[0]);Object.assign(sim.boxes.at(-1),{z:-GAP,state:'merge',ticket:sim.ticket++});
  }
  const [blocked,second,third]=sim.boxes.slice(1);
  run(sim,3.1);assert.equal(second.state,'main','02가 다른 합류점 때문에 정지하면 안 된다');
  assert.equal(blocked.state,'merge');
  run(sim,3.1);assert.equal(third.state,'main','03도 빈 합류점으로 진입해야 한다');
  assert.equal(blocked.z,-GAP);
  // 막혀 있던 가장 오래된 요청이 풀리면 정상 합류한다.
  sim.boxes[0].state='main';run(sim,7);
  assert.equal(blocked.state,'main');
});

test('오래된 요청이 풀려도 이미 진행 중인 합류를 가로채지 않는다',()=>{
  const sim=simulation();sim.spawnClock=-1000;sim.stepAgv=()=>{};
  sim.spawn(3,REGIONS[0]);const older=sim.boxes[0];Object.assign(older,{z:-GAP,state:'merge',ticket:0});
  sim.spawn(1,REGIONS[0]);const moving=sim.boxes[1];Object.assign(moving,{z:-1,state:'merge',ticket:1});
  run(sim,1);assert.equal(older.z,-GAP);assert.ok(moving.z>-1);
  run(sim,1.1);assert.equal(moving.state,'main');
  run(sim,3.1);assert.equal(older.state,'main');
});
test('30분 반복: 보존 법칙, 중앙 간격, 겹침 방지, 모든 목적지 도착',()=>{
  const sim=simulation(),seen=new Set();
  for(let i=0;i<1800*60;i++){
    sim.step(1/60);
    assert.equal(sim.created,sim.boxes.length+sim.delivered.reduce((a,b)=>a+b,0));
    const main=sim.boxes.filter(b=>!['inbound','merge','loaded'].includes(b.state)).sort((a,b)=>a.x-b.x);
    for(let j=1;j<main.length;j++)assert.ok(main[j].x-main[j-1].x>=GAP-1e-6,`간격 위반 t=${sim.time}`);
    if(i%60===0){
      for(const b of sim.boxes){seen.add(b.inlet);assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.z));}
      for(let a=0;a<sim.boxes.length;a++)for(let b=a+1;b<sim.boxes.length;b++){
        const p=sim.boxes[a],q=sim.boxes[b];
        assert.ok(Math.abs(p.x-q.x)>=0.85-1e-6||Math.abs(p.z-q.z)>=0.72-1e-6,`상자 겹침 ${p.id}/${q.id} t=${sim.time}`);
      }
    }
  }
  assert.equal(seen.size,4);assert.ok(sim.delivered.every(n=>n>0));assert.ok(sim.boxes.length<70);
  console.log('30분 결과',JSON.stringify({created:sim.created,delivered:sim.delivered,active:sim.boxes.length,parallelSeconds:Math.round(sim.parallelTime)}));
});
test('QR 실패는 인계를 중지하며 재시도 성공 후 복구한다',()=>{
  const sim=simulation();sim.spawn(0,REGIONS[0]);sim.boxes[0].x=8;sim.decode=()=>null;
  run(sim,20);assert.equal(sim.boxes[0].state,'error');assert.equal(sim.agv.box,null);assert.equal(sim.delivered[0],0);
  sim.decode=b=>decodeRegion(qr[REGIONS.indexOf(b.destination)]);sim.retryScan();run(sim,50);
  assert.ok(sim.delivered[0]>0);
});
test('잘못된 목적지 판독은 성공으로 처리하지 않는다',()=>{
  const sim=simulation();sim.spawn(0,REGIONS[0]);sim.boxes[0].x=8;sim.decode=()=>REGIONS[1];run(sim,5);
  assert.equal(sim.boxes[0].state,'error');assert.equal(sim.lastRead,null);
});
test('초기화는 운반 및 누적 상태를 제거한다',()=>{
  const sim=simulation();run(sim,120);sim.reset();assert.equal(sim.time,0);assert.equal(sim.boxes.length,0);assert.deepEqual(sim.delivered,[0,0,0]);assert.equal(sim.agv.state,'ready');
});
test('2·3대 AGV의 30분 배차: 장비 충돌·중복 적재·수량 유실 없이 모두 운행',()=>{
  for(const count of [2,3]){
    const sim=simulation();sim.setAgvCount(count);
    for(let i=0;i<1800*60;i++){
      sim.step(1/60);
      assert.equal(sim.created,sim.boxes.length+sim.delivered.reduce((a,b)=>a+b,0));
      const loads=sim.agvs.flatMap(a=>a.box?[a.box.id]:[]);assert.equal(loads.length,new Set(loads).size);
      for(let a=0;a<count;a++)for(let b=a+1;b<count;b++){
        const p=sim.agvs[a],q=sim.agvs[b];
        assert.ok(Math.abs(p.x-q.x)>=1.8-1e-6||Math.abs(p.z-q.z)>=1.45-1e-6,`AGV 충돌 ${a}/${b} t=${sim.time}`);
      }
      if(i%60===0)for(let a=0;a<sim.boxes.length;a++)for(let b=a+1;b<sim.boxes.length;b++){
        const p=sim.boxes[a],q=sim.boxes[b];assert.ok(Math.abs(p.x-q.x)>=0.85-1e-6||Math.abs(p.z-q.z)>=0.72-1e-6,'다중 AGV 상자 겹침');
      }
    }
    assert.ok(sim.parallelTime>10,'실제 동시 이동 시간');assert.ok(sim.agvs.every(a=>a.trips>0));assert.ok(sim.delivered.every(n=>n>0));
    console.log(`${count}대 30분 결과`,JSON.stringify({created:sim.created,delivered:sim.delivered,trips:sim.agvs.map(a=>a.trips),active:sim.boxes.length,parallelSeconds:Math.round(sim.parallelTime)}));
  }
});
test('AGV 대수 변경은 적재와 배차 예약까지 초기화한다',()=>{
  const sim=simulation();run(sim,60);sim.setAgvCount(3);
  assert.equal(sim.agvs.length,3);assert.equal(sim.boxes.length,0);assert.ok(sim.agvs.every(a=>a.segment===null));
  assert.throws(()=>sim.setAgvCount(0),RangeError);assert.throws(()=>sim.setAgvCount(13),RangeError);
});
test('여러 난수 시나리오에서도 병렬 AGV가 충돌하거나 교착되지 않는다',()=>{
  for(const seed of [1,27,998,4587,65535]){
    const sim=new Simulation({random:random(seed),agvCount:3,decode:b=>decodeRegion(qr[REGIONS.indexOf(b.destination)])});
    let atHalf=0;
    for(let frame=0;frame<1200*60;frame++){
      sim.step(1/60);
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
        const a=sim.agvs[i],b=sim.agvs[j];assert.ok(Math.abs(a.x-b.x)>=1.8-1e-6||Math.abs(a.z-b.z)>=1.45-1e-6,`seed=${seed}`);
      }
      if(frame===600*60)atHalf=sim.delivered.reduce((a,b)=>a+b,0);
    }
    assert.ok(sim.delivered.reduce((a,b)=>a+b,0)>atHalf+5,`교착 검사 seed=${seed}`);
    assert.ok(sim.parallelTime>100);
  }
});
test('QR 판독 전 선대기하고 누적 물량이 있으면 주차 대신 바로 복귀한다',()=>{
  const sim=simulation();sim.setAgvCount(3);sim.spawn(1,REGIONS[0]);sim.step(1/60);
  assert.equal(sim.lastRead,null);assert.ok(sim.agvs.some(a=>a.state==='staging'));
  let direct=false;
  for(let i=0;i<600*60;i++){sim.step(1/60);if(sim.events.some(e=>e.message.includes('QR 위치로 바로 복귀')))direct=true;}
  assert.ok(direct,'물량이 있는 경우 QR 직행 복귀를 실행해야 한다');
});



test('북쪽 직행 AGV가 안전 간격을 확보하면 다음 AGV가 인계를 준비한다',()=>{
  const sim=simulation();sim.setAgvCount(3);
  sim.spawn(0,REGIONS[0]);const box=sim.boxes[0];box.x=8;box.state='waiting';box.read=box.destination;
  let released=false;
  for(let i=0;i<600;i++){
    sim.step(1/60);
    const first=sim.agvs[0];
    if(['outbound','docking'].includes(first.state)&&first.z<=-2.1&&first.z>-7&&sim.pickupOwner!==0){released=true;break;}
  }
  assert.ok(released);
  sim.step(1/60);
  assert.notEqual(sim.pickupOwner,null);
  assert.equal(sim.agvs[sim.pickupOwner].state,'approaching');
});


test('도크가 사용 중이어도 대기 자리를 확보하면 선픽업하고 한 자리만 예약한다',()=>{
  const sim=simulation();sim.setAgvCount(3);
  sim.spawn(0,REGIONS[0]);const box=sim.boxes[0];Object.assign(box,{x:8,state:'waiting',read:REGIONS[0]});
  sim.dockOwners[0]=2;sim.stepAgv(1/60);
  assert.equal(sim.agvs[0].box,box);assert.equal(sim.dockWaitOwners[0],0);assert.equal(sim.dockOwners[0],2);
  sim.reset();assert.deepEqual(sim.dockWaitOwners,[null,null,null]);
});

test('통과한 출발 구간은 해제하고 회전 구간의 출구는 미리 예약한다',()=>{
  const sim=simulation();const a=sim.agvs[0];
  sim.requestTravel(a,'outbound',[{x:16,z:0},{x:16,z:-9.5},{x:19,z:-9.5}]);
  sim.stepAgv(1/60);assert.ok(a.turn,'회전 뒤 통로 예약');
  const initial=a.segment.minX;
  for(let i=0;i<30;i++)sim.stepAgv(1/60);
  assert.ok(a.segment.minX>initial,'지나간 영역 해제');
});

test('도크 본자리 확보 즉시 대기면을 풀어 후속 차량이 같은 목적지를 픽업한다',()=>{
  const sim=simulation();sim.setAgvCount(2);
  sim.spawn(0,REGIONS[0]);const first=sim.boxes[0];
  Object.assign(first,{x:8,state:'waiting',read:REGIONS[0]});
  for(let f=0;f<122;f++)sim.stepAgv(1/60);
  assert.equal(sim.dockOwners[0],0);assert.equal(sim.dockWaitOwners[0],null);
  // 앞차가 도크에 도착하기 전에도 후속 인계가 진행되어야 한다.
  sim.spawn(0,REGIONS[0]);const second=sim.boxes.at(-1);
  Object.assign(second,{x:8,state:'waiting',read:REGIONS[0]});
  for(let f=0;f<600&&!sim.agvs[1].box;f++)sim.stepAgv(1/60);
  assert.equal(sim.agvs[1].box,second);assert.equal(sim.dockWaitOwners[0],1);
  assert.equal(sim.delivered[0],0);
  // 대기 차량의 승격도 대기면 예약을 즉시 반환해야 한다.
  sim.reset();const a=sim.agvs[0];
  Object.assign(a,{state:'dockWaiting',dock:0,x:19,z:-9.5});
  sim.pickupOwner=null;sim.dockWaitOwners[0]=0;
  sim.stepAgv(1/60);
  assert.equal(sim.dockOwners[0],0);assert.equal(sim.dockWaitOwners[0],null);
});

test('예약 대기 시간을 ETA에 포함하고 이동 중 배차에서도 현재 구간을 보존한다',()=>{
  const sim=simulation();sim.setAgvCount(2);const a=sim.agvs[0],b=sim.agvs[1];
  Object.assign(a,{x:10,z:0});Object.assign(b,{x:14,z:0,state:'returning',route:[{x:14,z:10}],segment:{minX:13.02,maxX:14.98,minZ:-0.82,maxZ:10.82}});
  const direct=[{x:16,z:0}];assert.ok(sim.arrivalTime(a,direct)>sim.routeLength(a,direct)/1.2);
  a.state='loading';sim.pickupOwner=null;const segment=b.segment;
  sim.dispatch('approaching');assert.equal(sim.pickupOwner,b.id);assert.equal(b.segment,segment);
  assert.deepEqual(b.route[0],{x:14,z:10});
});

test('선대기 차량이 먼저 도착하면 뒤쪽 지정 차량 대신 인계하며 서로 막지 않는다',()=>{
  const sim=simulation();sim.setAgvCount(2);const [a,b]=sim.agvs;
  Object.assign(a,{x:13,z:2.5,state:'approaching',route:[{x:10,z:2.5},{x:10,z:0}],segment:null});
  Object.assign(b,{x:10,z:2.5,state:'standby',route:[],segment:null});
  sim.pickupOwner=a.id;sim.standbyOwner=b.id;sim.stepAgv(1/60);
  assert.equal(sim.pickupOwner,b.id);assert.equal(sim.standbyOwner,a.id);assert.ok(b.z<2.5);
});

test('같은 목적지 연속 출하도 도크 대기·출구 분리로 충돌과 교착 없이 진행한다',()=>{
  for(let dock=0;dock<3;dock++){
    const sim=simulation();sim.setAgvCount(3);let half=0,sawQueue=false;
    for(let frame=0;frame<900*60;frame++){
      // 유입·간격 처리는 원본 그대로 실행하고 모든 상자의 목적지만 고정한다.
      for(const b of sim.boxes)if(!b.read)b.destination=REGIONS[dock];
      sim.step(1/60);
      sawQueue ||= sim.agvs.some(a=>a.state==='dockWaiting');
      assert.equal(sim.created,sim.boxes.length+sim.delivered.reduce((a,b)=>a+b,0));
      for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
        const a=sim.agvs[i],b=sim.agvs[j];assert.ok(Math.abs(a.x-b.x)>=1.8-1e-6||Math.abs(a.z-b.z)>=1.45-1e-6);
      }
      if(frame===450*60)half=sim.delivered[dock];
    }
    assert.ok(sawQueue);assert.ok(sim.delivered[dock]>half+8,`도크 ${dock} 교착`);
  }
});


test('기본4대 및1~12대 범위 검증, 4~12대 장기 충돌·교착 검사',()=>{
  assert.equal(new Simulation({decode:b=>b.destination}).agvs.length,4);
  for(const n of [0,13,1.5,NaN])assert.throws(()=>new Simulation({agvCount:n}),RangeError);
  for(const count of [4,5,6,7,8,9,10,11,12])for(const seed of [1,27,998]){
    const sim=new Simulation({agvCount:count,random:random(seed),decode:b=>b.destination});let half=0;
    for(let f=0;f<600*60;f++){
      sim.step(1/60);
      assert.equal(sim.created,sim.boxes.length+sim.delivered.reduce((a,b)=>a+b,0));
      for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
        const a=sim.agvs[i],b=sim.agvs[j];assert.ok(Math.abs(a.x-b.x)>=1.8-1e-6||Math.abs(a.z-b.z)>=1.45-1e-6,`충돌 ${count}/${seed}`);
      }
      if(f===300*60)half=sim.delivered.reduce((a,b)=>a+b,0);
    }
    assert.ok(sim.delivered.reduce((a,b)=>a+b,0)>half+5,`교착 ${count}/${seed}`);
  }
});
