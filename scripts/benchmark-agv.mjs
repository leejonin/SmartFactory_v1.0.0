import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation.js';

/** 생성 규칙을 바꾸지 않고 같은 유입·목적지 선택을 재현한다. */
function random(seed){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}

// 정상 QR 판독만 가정하는 물류 시험이다. QR 픽셀 검증은 npm test에서 수행한다.
const results=[];
for(const count of [4,12])for(const seed of [1,27,998,4587,65535]){
  const sim=new Simulation({agvCount:count,random:random(seed),decode:b=>b.destination});
  let max=0,sum=0,over=0,waiting=0,half=0;
  for(let frame=0;frame<1800*60;frame++){
    sim.step(1/60);
    const n=sim.boxes.length,total=sim.delivered.reduce((a,b)=>a+b,0);
    assert.equal(sim.created,n+total,'상자 수량 보존');
    for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
      const a=sim.agvs[i],b=sim.agvs[j];
      assert.ok(Math.abs(a.x-b.x)>=1.8-1e-6||Math.abs(a.z-b.z)>=1.45-1e-6,`충돌 ${count}/${seed}/${sim.time}`);
    }
    max=Math.max(max,n);sum+=n;if(n>20)over++;
    if(sim.boxes.some(b=>b.state==='waiting'))waiting++;
    if(frame===900*60)half=total;
  }
  const delivered=sim.delivered.reduce((a,b)=>a+b,0);
  assert.ok(delivered>half+5,`후반 운행 정지 ${count}/${seed}`);
  results.push({count,seed,max,mean:sum/108000,overSeconds:over/60,waitingSeconds:waiting/60,delivered});
}
console.log(JSON.stringify({seconds:1800,dt:1/60,target:20,metric:'컨베이어와 AGV 적재를 모두 포함한 sim.boxes.length',results},null,2));
