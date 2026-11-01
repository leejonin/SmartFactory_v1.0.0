import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { INLETS, DOCKS } from './simulation.js';
import { LAYERS } from './layout.js';
import rollerUrl from '../Asset/straight-roller-conveyor.glb?url';
import beltUrl from '../Asset/belt-conveyor-straight.glb?url';
import agvUrl from '../Asset/warehouse-agv-with-shelf.glb?url';
import truckUrl from '../Asset/7-5-t-class-box-truck-with-roll-up-door.glb?url';

export const COLORS = ['#dfad59', '#55aaa5', '#899bc7'];
const matCache = new Map();
/** 같은 색상 재질을 공유하여 장면의 자원 수를 제한한다. */
function material(color) { if (!matCache.has(color)) matCache.set(color,new THREE.MeshStandardMaterial({color,roughness:0.72,metalness:0.15})); return matCache.get(color); }
/** 바닥·구조물용 직육면체를 만든다. */
function block(parent,w,h,d,x,y,z,color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
/** 한글 표지판을 CanvasTexture로 생성한다. */
function label(parent,text,x,y,z,width=3,color='#24363b',ground=false) {
  const canvas=document.createElement('canvas'); canvas.width=768;canvas.height=128;
  const c=canvas.getContext('2d'); c.fillStyle=color; c.font='600 56px "Malgun Gothic", sans-serif'; c.textAlign='center';c.textBaseline='middle';c.fillText(text,384,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/6),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  mesh.position.set(x,y,z); if(ground) mesh.rotation.x=-Math.PI/2;parent.add(mesh);return mesh;
}
/** 원본 GLB를 상자 범위에 맞추고 바닥 원점을 정렬한다. */
function fitModel(source,width,height,depth) {
  const result=new THREE.Group();const model=source.clone(true);result.add(model);
  const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-bounds.min.y,-center.z);
  result.scale.set(width/size.x,height/size.y,depth/size.z);return result;
}
/** 정적 트럭의 같은 재질 메시를 합쳐 반복 배치의 그리기 호출을 줄인다. */
function batchStatic(model) {
  model.updateMatrixWorld(true);const groups=new Map(),result=new THREE.Group();
  model.traverse(n=>{
    if(!n.isMesh)return;
    const key=n.material.uuid+Object.keys(n.geometry.attributes).sort().join(',')+Boolean(n.geometry.index);
    if(!groups.has(key))groups.set(key,{material:n.material,geometries:[]});
    groups.get(key).geometries.push(n.geometry.clone().applyMatrix4(n.matrixWorld));
  });
  for(const group of groups.values()){
    const merged=mergeGeometries(group.geometries);if(!merged)throw new Error('트럭 정적 메시 병합 실패');
    const mesh=new THREE.Mesh(merged,group.material);mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);
    group.geometries.forEach(g=>g.dispose());
  }
  return result;
}
/** 실제 장비 모델·공장 환경·카메라를 생성하고 시뮬레이션 상태를 그린다. SW_Browser_Logistics_001 */
export function createScene(container,qrImages,onAssetStatus) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#cbd4d3');scene.fog=new THREE.Fog('#cbd4d3',400,750);
  const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.className='scene';renderer.domElement.setAttribute('aria-label','4개 레이어의 16개 유입구, QR 4개, AGV, 출하 도크와 탑차 각 12대를 보여주는 3D 공장');container.prepend(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(42,1,0.1,800);camera.position.set(28,31,34);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,-1);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2.08;controls.minDistance=4;controls.maxDistance=400;controls.update();
  scene.add(new THREE.HemisphereLight('#f4faff','#657781',2.7));
  const sun=new THREE.DirectionalLight('#fff4df',3.2);sun.position.set(-12,100,42);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-100,right:120,top:160,bottom:-160,near:1,far:300});sun.shadow.normalBias=0.04;scene.add(sun);
  const world=scene, loader=new GLTFLoader(),assetCache=new Map();let loaded=0,truckBatch;
  // 네 물류 라인이 공유하는 하나의 공장 바닥과 외벽. 내부 구역별 바닥·벽은 만들지 않는다.
  block(world,62,0.2,120,6,-0.15,44,'#9aa8a7');
  const grid=new THREE.GridHelper(120,120,'#8a9b9b','#adb9b6');grid.scale.x=62/120;grid.position.set(6,-0.035,44);world.add(grid);
  block(world,62,4.4,0.3,6,2.1,-16,'#b6c2c0');
  for(let x=-24;x<=36;x+=8){block(world,0.24,5.5,0.3,x,2.7,-15.7,'#65777b');block(world,0.45,0.15,0.55,x,5.3,-15.5,'#d8e4dc');}
  label(world,'FLOW / SMART FACTORY',6,3.3,-15.79,22);
  /** 동일 기본 장면을 레이어 원점에 배치하고 독립 상태 동기화 함수를 만든다. */
  function buildLayer(definition,qrImages){
    const scene=new THREE.Group();scene.name=definition.id;scene.userData.layerId=definition.id;
    scene.position.set(definition.x,0,definition.z);world.add(scene);
    const regions=definition.regions;
  label(scene,definition.id + ' / LOGISTICS LINE',-5,0.025,-12,9,'#486367',true);
  for(let x=-18;x<22;x+=2) block(scene,1.1,0.015,0.07,x,0.006,3.1,'#d8b15d');
  for(let z=-11;z<=12;z+=1.7){block(scene,0.08,0.015,0.85,14.5,0.01,z,'#d8b15d');block(scene,0.08,0.015,0.85,20.5,0.01,z,'#8ac0bb');}
  label(scene,'OUTBOUND',16,0.025,-10,3,'#6f633d',true);
  label(scene,'RETURN',19,0.025,14,3,'#426a65',true);
  const beltGroup=new THREE.Group();scene.add(beltGroup);
  const placeholders=[];
  /** 모델 로딩 전에도 이송 경로를 정확하게 표시한다. */
  function conveyor(x,z,length,vertical=false) {
    const g=new THREE.Group();g.position.set(x,0,z);if(vertical)g.rotation.y=Math.PI/2;
    block(g,length,0.16,1.35,0,0.91,0,'#364a51');
    for(const side of [-0.68,0.68])block(g,length,0.18,0.06,0,0.98,side,'#a6b3b3');
    for(const xx of [-length/2+0.3,length/2-0.3])for(const zz of [-0.52,0.52])block(g,0.09,0.9,0.09,xx,0.45,zz,'#596b70');
    beltGroup.add(g);placeholders.push({g,x,z,length,vertical});
  }
  for(let x=-12;x<=6;x+=4)conveyor(x,0,4);
  conveyor(7,0,2);
  for(const inlet of INLETS.slice(1))conveyor(inlet.x,-4.75,8.5,true);
  for(let i=0;i<4;i++) {
    const p=INLETS[i]; label(scene,`0${i+1}  유입`,p.x,0.04,p.z-1.5,2.7,'#435d61',true);
    if(i){block(scene,1.8,2.4,0.25,p.x,1.2,-9.7,'#64797e');block(scene,1.28,1.5,0.28,p.x,1.25,-9.52,'#253c43');}
    else {block(scene,0.25,2.4,1.8,-14.6,1.2,0,'#64797e');block(scene,0.28,1.5,1.28,-14.42,1.25,0,'#253c43');}
  }
  const scanner=new THREE.Group();scanner.position.x=8;scene.add(scanner);
  for(const z of [-0.94,0.94])block(scanner,0.16,2.5,0.16,0,1.25,z,'#d8ad55');
  block(scanner,0.28,0.16,2,0,2.5,0,'#d8ad55');block(scanner,0.35,0.2,0.4,0,2.32,0,'#263f48');
  const scanLight=block(scanner,0.015,0.015,1.2,0,1.61,0,'#55dbb3');scanLight.material=new THREE.MeshBasicMaterial({color:'#56e8b5'});
  label(scene,'QR / SCAN',8,0.035,2,3,'#3e5a5d',true);
  for(const z of [1.6,3.4])block(scene,2.1,0.018,0.05,10,0.02,z,'#ddbe74');
  label(scene,'NEXT AGV',10,0.035,4.1,2,'#6d653c',true);
  block(scene,2,0.12,1.3,9,0.92,0,'#50646a');
  const agv=new THREE.Group();scene.add(agv);
  const agvModels=[agv];
  const fallbackAgv=block(agv,1.65,0.55,1.35,0,0.38,0,'#d2a34c');
  block(agv,1.6,0.12,1.25,0,0.94,0,'#8c9b9a');
  for(const z of [-0.66,0.66])block(agv,1.3,0.18,0.06,0,0.83,z,'#b8c6c5');
  for(let i=0;i<3;i++){
    const z=4+i*2.6;block(scene,2.2,0.018,1.9,7,0.006,z,'#829a98');
    label(scene,`AGV 0${i+1}`,7,0.035,z+1.15,2,'#425f61',true);
  }
  const dockModels=[];
  for(let i=0;i<3;i++) {
    const d=DOCKS[i];block(scene,5.4,0.025,4.2,d.x+2,0.01,d.z,'#819596');
    for(const z of [-2.1,2.1])block(scene,5.4,0.035,0.09,d.x+2,0.03,d.z+z,COLORS[i]);
    block(scene,1.8,0.95,1.6,d.x+1.9,0.45,d.z,'#62777c');
    label(scene,`0${i+1}  ${regions[i]}`,d.x+1.8,0.05,d.z+2.9,4,COLORS[i],true);
    const bay=new THREE.Group();bay.position.set(d.x+6,0,d.z);bay.rotation.y=Math.PI;scene.add(bay);dockModels.push(bay);
    block(bay,4.6,2.8,2.3,0,1.65,0,'#d4dedb');block(bay,1.7,2.1,2.2,3,1.3,0,'#839ca2');
    for(const x of [-1.6,2.8])for(const z of [-1.1,1.1])block(bay,0.75,0.75,0.25,x,0.4,z,'#283c44');
  }
  const qrTextures=qrImages.map(p=>{const t=new THREE.DataTexture(p.data,p.width,p.height,THREE.RGBAFormat);t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;t.magFilter=THREE.NearestFilter;return t;});
  const boxGeometry=new THREE.BoxGeometry(0.85,0.55,0.72), qrGeometry=new THREE.PlaneGeometry(0.48,0.48);
  const tapeGeometry=new THREE.BoxGeometry(0.1,0.557,0.725),bandGeometry=new THREE.BoxGeometry(0.86,0.08,0.73);
  const boxMaterial=material('#bd955e'), tapeMaterial=material('#dfc596');
  const qrMaterials=qrTextures.map(t=>new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));
  const boxes=new Map();
  /** 활성 상자만 보관하고 배송된 메시를 장면에서 제거한다. */
  function sync(sim) {
    const alive=new Set(sim.boxes.map(b=>b.id));for(const [id,g] of boxes)if(!alive.has(id)){scene.remove(g);boxes.delete(id);}
    for(const b of sim.boxes){
      let g=boxes.get(b.id);
      if(!g){
        g=new THREE.Group();const mesh=new THREE.Mesh(boxGeometry,boxMaterial);mesh.castShadow=true;g.add(mesh);
        const tape=new THREE.Mesh(tapeGeometry,tapeMaterial);g.add(tape);
        const qr=new THREE.Mesh(qrGeometry,qrMaterials[regions.indexOf(b.destination)]);qr.rotation.x=-Math.PI/2;qr.position.set(0,0.281,0);g.add(qr);
        const band=new THREE.Mesh(bandGeometry,material(COLORS[regions.indexOf(b.destination)]));band.position.y=-0.19;g.add(band);
        boxes.set(b.id,g);scene.add(g);
      }
      g.position.set(b.x,1.29,b.z);
    }
    while(agvModels.length<sim.agvs.length){const clone=agv.clone(true);scene.add(clone);agvModels.push(clone);}
    while(agvModels.length>sim.agvs.length)scene.remove(agvModels.pop());
    sim.agvs.forEach((a,i)=>agvModels[i].position.set(a.x,0,a.z));
    scanLight.visible=sim.boxes.some(b=>b.state==='scan') && Math.sin(sim.time*15)>0;
  }

  /** GLB 적용 실패는 상태 표시로 알리고 기본 장비 형상을 유지한다. */
  async function load(url,apply) {
    try {if(!assetCache.has(url))assetCache.set(url,loader.loadAsync(url));const result=await assetCache.get(url);apply(result.scene.clone(true));loaded++;onAssetStatus(`${loaded}/16 레이어 장비 배치 완료`);}
    catch(error){onAssetStatus(`장비 모델 오류 · 기본 형상 사용`);console.error('장비 로드 실패',error);}
  }
  const assetsReady=Promise.all([
    load(rollerUrl,model=>{const cartons=[];model.traverse(n=>{if(/Cartons/i.test(n.name))cartons.push(n);});cartons.forEach(n=>n.removeFromParent());for(const p of placeholders.filter(p=>!p.vertical)){beltGroup.remove(p.g);const m=fitModel(model,p.length,1,1.35);m.position.set(p.x,0,p.z);beltGroup.add(m);}}),
    load(beltUrl,model=>{const cartons=[];model.traverse(n=>{if(/Cartons/i.test(n.name))cartons.push(n);});cartons.forEach(n=>n.removeFromParent());for(const p of placeholders.filter(p=>p.vertical)){beltGroup.remove(p.g);const m=fitModel(model,p.length,1,1.35);m.rotation.y=Math.PI/2;m.position.set(p.x,0,p.z);beltGroup.add(m);}}),
    load(agvUrl,model=>{const remove=[];model.traverse(n=>{if(/Fabric[_ ]bins|Pod[_ ]frame|Stored[_ ]boxes/i.test(n.name))remove.push(n);});remove.forEach(n=>n.removeFromParent());const m=fitModel(model,1.8,0.82,1.45);agv.remove(fallbackAgv);agv.add(m);while(agvModels.length>1)scene.remove(agvModels.pop());}),
    load(truckUrl,model=>{const batched=truckBatch||(truckBatch=batchStatic(model));for(const bay of dockModels){bay.clear();bay.add(fitModel(batched,6.6,3.25,2.5));}})
  ]);
    return {sync,assetsReady};
  }
  const layerViews=LAYERS.map((definition,i)=>buildLayer(definition,qrImages[i]));
  const assetsReady=Promise.all(layerViews.map(layer=>layer.assetsReady));
  /** 같은 프레임에서 네 레이어의 상태를 각각 대응하는 장면에 반영한다. */
  function sync(factory){factory.layers.forEach((layer,i)=>layerViews[i].sync(layer.simulation));}
  /** 기준 카메라로 전환하며 OrbitControls 직접 조작을 유지한다. */
  let activeView='overview';
  function view(name) {
    activeView=name;
    const presets={top:[[6,175,44.01],[6,0,44]],qr:[[14,8,10],[7,1,0]],agv:[[24,15,21],[14,0.7,2]],overview:[[90,145,165],[6,0,44]]};
    const [p,t]=presets[name]||presets.overview;camera.position.fromArray(p);controls.target.fromArray(t);
    if(name==='top'||name==='overview')camera.position.sub(controls.target).multiplyScalar(Math.max(1,(name==='top'?0.5:0.85)/camera.aspect)).add(controls.target);
    controls.update();
  }
  const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);view(activeView);});observer.observe(container);
  return {sync,view,assetsReady,render(){controls.update();renderer.render(scene,camera);}, get stats(){return renderer.info.render;}};
}





