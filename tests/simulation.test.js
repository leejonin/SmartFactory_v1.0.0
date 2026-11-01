import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, GAP, INLETS } from '../src/simulation.js';
import { REGIONS, encodeRegion, decodeRegion } from '../src/qr.js';

const qr=REGIONS.map(encodeRegion);
/** 재현 가능한 난수원을 반환한다. */
function random(seed=341){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
/** 실제 QR 픽셀 판독을 사용하는 시험 인스턴스를 생성한다. */
function simulation(){return new Simulation({random:random(),decode:b=>decodeRegion(qr[REGIONS.indexOf(b.destination)])});}
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
  assert.throws(()=>sim.setAgvCount(0),RangeError);assert.throws(()=>sim.setAgvCount(4),RangeError);
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

