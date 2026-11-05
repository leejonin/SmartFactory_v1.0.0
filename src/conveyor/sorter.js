/**
 * 공두이노 DIY 컨베이어 색상 분류 키트의 동작 상태기계(3D와 분리된 순수 로직). SW_Browser_Logistics_001
 * 좌표: x=벨트 진행 방향(입구 0 → 끝단 L), z=벨트 폭 방향(+는 앞쪽), y=높이. 단위 m·초.
 * 순서: 투입 → 적외선 근접센서 감지 → 컬러센서 판독 → 해당 색 게이트(서보 팔) 작동 → 옆 상자로 밀려 떨어짐.
 * 빨강은 게이트 없이 벨트 끝에서 떨어진다.
 */
export const KIT = {
  L: 0.56, beltY: 0.1, beltHalf: 0.035, speed: 0.045, half: 0.0125,
  irX: 0.22, sensorX: 0.29, readTime: 0.25, spawnEvery: 3.6, spawnGap: 0.16,
  armLength: 0.12, armAngle: 0.84, servoRate: 6,
  gates: {
    yellow: { x: 0.42, z: 0.068, side: 1 },
    green: { x: 0.5, z: -0.068, side: -1 },
  },
  bins: {
    red: { x: 0.645, z: 0, floor: 0.004 },
    yellow: { x: 0.395, z: 0.125, floor: 0.004 },
    green: { x: 0.475, z: -0.125, floor: 0.004 },
  },
};
export const CUBE_COLORS = ['red', 'yellow', 'green'];
/** 컬러센서(TCS34725 유형)의 원시 RGB 대표값. 화면 표시용 근사치다. */
const RAW = { red: [214, 46, 38], yellow: [226, 181, 40], green: [44, 140, 64] };

/** 서보 팔의 현재 방향 벡터. 쉬는 자세는 벨트 가장자리를 따라 입구 쪽(-x)을 향하고, 작동하면 armAngle만큼 벨트 위로 들어온다.
 * @param {{side:number}} gate 게이트 설정. @param {number} k 작동 정도 0~1.
 * @returns {{x:number,z:number}} 단위 방향.
 */
export function armDirection(gate, k) {
  const heading = Math.PI + gate.side * KIT.armAngle * k;
  return { x: Math.cos(heading), z: Math.sin(heading) };
}

export class Sorter {
  /** @param {{random?: () => number}} [options] 난수원(테스트 재현용). */
  constructor({ random = Math.random } = {}) { this.random = random; this.reset(); }
  /** 모든 상자·카운트·게이트를 처음 상태로 되돌린다. */
  reset() {
    this.time = 0; this.nextId = 1; this.spawnTimer = 0.5; this.cubes = [];
    this.counts = { red: 0, yellow: 0, green: 0 };
    this.gates = { yellow: { k: 0, target: 0, owner: null }, green: { k: 0, target: 0, owner: null } };
    this.ir = false; this.sensorLight = 0; this.lastReading = null; this.events = [];
  }
  /** 사건을 최근 순으로 6개까지 보관한다. */
  log(message) { this.events.unshift({ time: this.time, message }); this.events.length = Math.min(this.events.length, 6); }
  /** 입구가 비어 있으면 무작위 색 상자를 올린다. */
  spawn() {
    if (this.cubes.some(c => c.state === 'belt' && c.x < 0.035 + KIT.spawnGap)) return false;
    const color = CUBE_COLORS[Math.floor(this.random() * 3)];
    this.cubes.push({ id: this.nextId++, color, x: 0.035, y: KIT.beltY + KIT.half, z: (this.random() - 0.5) * 0.012,
      yaw: (this.random() - 0.5) * 0.3, roll: 0, pitch: 0, state: 'belt', read: null, readTimer: 0 });
    this.log(`#${this.nextId - 1} 투입`); return true;
  }
  /** 고정 시간 간격으로 상태를 진행한다. @param {number} dt 초. */
  step(dt) {
    this.time += dt; this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawn()) this.spawnTimer = KIT.spawnEvery;
    else if (this.spawnTimer <= 0) this.spawnTimer = 0.2;
    this.ir = false; this.sensorLight = Math.max(0, this.sensorLight - dt * 3);
    for (const cube of this.cubes) {
      if (cube.state === 'belt') this.moveOnBelt(cube, dt);
      else if (cube.state === 'falling') this.fall(cube, dt);
    }
    this.updateGates(dt);
    const binned = this.cubes.filter(c => c.state === 'binned');
    if (binned.length > 24) { const old = binned[0]; this.cubes.splice(this.cubes.indexOf(old), 1); }
  }
  /** 벨트 위 이동, 센서 감지·판독, 게이트 접촉과 낙하 시작을 처리한다. */
  moveOnBelt(cube, dt) {
    cube.x += KIT.speed * dt;
    if (Math.abs(cube.x - KIT.irX) < KIT.half) this.ir = true;
    if (!cube.read && cube.x >= KIT.sensorX) {
      cube.readTimer += dt; this.sensorLight = 1;
      if (cube.readTimer >= KIT.readTime) {
        cube.read = cube.color;
        const rgb = RAW[cube.color].map(v => Math.round(v + (this.random() - 0.5) * 12));
        this.lastReading = { id: cube.id, color: cube.color, rgb };
        this.log(`#${cube.id} 판독 ${({ red: '빨강', yellow: '노랑', green: '초록' })[cube.color]} (R${rgb[0]} G${rgb[1]} B${rgb[2]})`);
      }
    }
    for (const [name, gate] of Object.entries(KIT.gates)) this.pushByArm(cube, gate, this.gates[name].k);
    if (cube.z > KIT.beltHalf) this.startFall(cube, 'yellow');
    else if (cube.z < -KIT.beltHalf) this.startFall(cube, 'green');
    else if (cube.x > KIT.L + 0.004) this.startFall(cube, 'red');
  }
  /** 작동 중인 서보 팔이 상자를 막으면 팔 면을 따라 밀어 낸다(벨트는 +x로 계속 민다). */
  pushByArm(cube, gate, k) {
    if (k < 0.05) return;
    const d = armDirection(gate, k);
    // 팔의 상류 쪽(입구 쪽) 법선: 방향 벡터를 90° 돌린 두 후보 중 x가 음수인 것.
    const n = -d.z < 0 ? { x: -d.z, z: d.x } : { x: d.z, z: -d.x };
    const rx = cube.x - gate.x, rz = cube.z - gate.z, along = rx * d.x + rz * d.z, dist = rx * n.x + rz * n.z;
    if (along < -KIT.half || along > KIT.armLength + KIT.half) return;
    if (dist < KIT.half && dist > -KIT.half * 2) { cube.x += (KIT.half - dist) * n.x; cube.z += (KIT.half - dist) * n.z; }
  }
  /** 상자 위 무작위 적재 위치로 포물선 낙하를 시작한다. */
  startFall(cube, bin) {
    const b = KIT.bins[bin], slot = this.counts[bin] % 9, layer = Math.floor(this.counts[bin] / 9) % 2;
    cube.state = 'falling'; cube.bin = bin; cube.t = 0;
    cube.from = { x: cube.x, y: cube.y, z: cube.z };
    cube.to = { x: b.x + ((slot % 3) - 1) * 0.027 + (this.random() - 0.5) * 0.004, y: b.floor + KIT.half + layer * 0.026, z: b.z + (Math.floor(slot / 3) - 1) * 0.027 };
    if (bin !== 'red') this.releaseGate(bin, cube.id);
  }
  /** 포물선으로 상자 안에 떨어뜨리고, 도착하면 개수를 올린다. */
  fall(cube, dt) {
    cube.t = Math.min(1, cube.t + dt / 0.5); const t = cube.t, f = cube.from, g = cube.to;
    cube.x = f.x + (g.x - f.x) * t; cube.z = f.z + (g.z - f.z) * t;
    cube.y = f.y + (g.y - f.y) * t + 0.03 * Math.sin(Math.PI * t) * (1 - t);
    cube.roll += dt * 6 * Math.sign(g.z - f.z || 1); cube.pitch += dt * (cube.bin === 'red' ? 7 : 2);
    if (t >= 1) {
      cube.state = 'binned'; cube.roll = Math.round(cube.roll / (Math.PI / 2)) * Math.PI / 2; cube.pitch = Math.round(cube.pitch / (Math.PI / 2)) * Math.PI / 2;
      this.counts[cube.bin]++; this.log(`#${cube.id} ${({ red: '빨강', yellow: '노랑', green: '초록' })[cube.bin]} 상자 도착`);
    }
  }
  /** 판독된 상자가 게이트 앞에 오면 해당 서보를 작동하고, 떨어지면 되돌린다. */
  updateGates(dt) {
    for (const [name, gate] of Object.entries(KIT.gates)) {
      const state = this.gates[name];
      if (!state.owner) {
        const tipX = gate.x - KIT.armLength * Math.cos(KIT.armAngle);
        const next = this.cubes.find(c => c.state === 'belt' && c.read === name && c.x > tipX - 0.05 && c.x < gate.x);
        if (next) { state.owner = next.id; state.target = 1; }
      }
      state.k += Math.sign(state.target - state.k) * Math.min(Math.abs(state.target - state.k), KIT.servoRate * dt);
    }
  }
  /** 게이트가 담당한 상자가 떨어지면 팔을 쉬는 자세로 되돌린다. */
  releaseGate(name, id) { const state = this.gates[name]; if (state.owner === id) { state.owner = null; state.target = 0; } }
}
