import test from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/factory.js';
import { LAYERS } from '../src/layout.js';
import { decodeRegion } from '../src/qr.js';

/** 네 공정 시험에 사용하는 재현 가능한 난수원. */
function random(seed=941){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}

test('4개 공정과 12개 목적지 QR 대응, 다른 공정 목적지 거절',()=>{
  const factory=new FactorySimulation({layerCount:4,random:random()});
  assert.equal(factory.layers.length,4);assert.equal(factory.delivered.length,12);assert.equal(factory.agvs.length,16);
  assert.equal(new Set(LAYERS.flatMap(l=>l.regions)).size,12);
  LAYERS.forEach((layer,i)=>layer.regions.forEach((region,j)=>{
    assert.equal(decodeRegion(factory.qrImages[i][j],layer.regions),region);
    assert.equal(decodeRegion(factory.qrImages[i][j],LAYERS[(i+1)%4].regions),null);
  }));
});
test('네 공정 10분 병행: 모든 도크 인도, 공정 독립성, 세계 좌표 장비 충돌 없음',()=>{
  const factory=new FactorySimulation({layerCount:4,random:random()});
  for(let frame=0;frame<600*60;frame++){
    factory.step(1/60);
    for(const layer of factory.layers){
      const sim=layer.simulation;
      assert.equal(sim.created,sim.boxes.length+sim.delivered.reduce((a,b)=>a+b,0));
      assert.ok(sim.boxes.every(b=>layer.regions.includes(b.destination)));
    }
    if(frame%60===0){
      const world=factory.layers.flatMap(l=>l.simulation.agvs.map(a=>({x:a.x+l.x,z:a.z+l.z})));
      for(let i=0;i<world.length;i++)for(let j=i+1;j<world.length;j++)assert.ok(Math.abs(world[i].x-world[j].x)>=1.8-1e-6||Math.abs(world[i].z-world[j].z)>=1.45-1e-6);
    }
  }
  assert.ok(factory.delivered.every(n=>n>0));assert.ok(factory.lastRead.layer);
  console.log('4공정 10분 도크별 인도',JSON.stringify(factory.delivered));
  const otherBefore=factory.layers[1].simulation.created;factory.layers[0].simulation.reset();
  assert.equal(factory.layers[1].simulation.created,otherBefore);
});
test('AGV 설정은 네 공정에 같은 N대를 적용하고 모든 예약을 초기화한다',()=>{
  const factory=new FactorySimulation({layerCount:4,random:random()});
  for(const count of Array.from({length:12},(_,i)=>i+1)){
    factory.setAgvCount(count);assert.equal(factory.agvs.length,4*count);
    assert.ok(factory.layers.every(l=>l.simulation.agvs.length===count));
    assert.equal(factory.boxes.length,0);assert.equal(factory.delivered.reduce((a,b)=>a+b,0),0);
  }
});


test('기본 1공정, 1~4 전환과 숨긴 공정 정지·집계 제외',()=>{
  const factory=new FactorySimulation({random:random()});
  assert.equal(factory.layers.length,1);assert.equal(factory.agvs.length,4);
  factory.setAgvCount(2);
  for(const count of [4,2,3,1]){
    factory.setLayerCount(count);
    assert.equal(factory.layers.length,count);assert.equal(factory.agvs.length,count*2);
    assert.equal(factory.time,0);assert.equal(factory.boxes.length,0);
    assert.deepEqual(factory.delivered,Array(count*3).fill(0));
    assert.equal(factory.lastRead,null);
    for(let frame=0;frame<60*30;frame++)factory.step(1/60);
    assert.ok(factory.time>29);
    assert.ok(factory.allLayers.slice(count).every(l=>l.simulation.time===0&&l.simulation.created===0));
    assert.equal(factory.boxes.length,factory.layers.reduce((n,l)=>n+l.simulation.boxes.length,0));
    const time=factory.time;factory.setLayerCount(count);assert.equal(factory.time,time);
  }
  for(const count of [0,5,-1,1.5,NaN,'2',null])assert.throws(()=>factory.setLayerCount(count),RangeError);
  assert.equal(factory.layers.length,1);
});
