import test from 'node:test';
import assert from 'node:assert/strict';
import { Sorter, KIT } from '../src/conveyor/sorter.js';

/** 고정 시드 난수. */
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
/** 모의 시간을 1/60초 단위로 진행한다. */
function run(sorter, seconds) { for (let i = 0; i < seconds * 60; i++) sorter.step(1 / 60); }

test('모든 상자는 자기 색 상자에 도착하고 개수가 맞다', () => {
  for (const seed of [1, 7, 42, 2026]) {
    const sorter = new Sorter({ random: seeded(seed) });
    const placed = new Map();
    for (let i = 0; i < 300 * 60; i++) {
      sorter.step(1 / 60);
      for (const c of sorter.cubes) if (c.state === 'binned' && !placed.has(c.id)) placed.set(c.id, c);
    }
    assert.ok(placed.size >= 70, `seed ${seed}: 5분에 70개 이상 분류 (${placed.size})`);
    for (const c of placed.values()) assert.equal(c.bin, c.color, `seed ${seed} #${c.id} ${c.color}→${c.bin}`);
    const total = Object.values(sorter.counts).reduce((a, b) => a + b, 0);
    assert.equal(total, placed.size);
    for (const color of ['red', 'yellow', 'green']) assert.ok(sorter.counts[color] > 0, `seed ${seed} ${color} 0개`);
  }
});

test('판독 전에는 게이트가 움직이지 않고, 담당 상자가 떨어지면 쉬는 자세로 돌아온다', () => {
  const sorter = new Sorter({ random: () => 0.5 }); // 항상 노랑
  run(sorter, 3);
  assert.equal(sorter.gates.yellow.k, 0);
  run(sorter, 12);
  assert.ok(sorter.counts.yellow >= 1);
  run(sorter, 0.1);
  const busy = sorter.cubes.some(c => c.state === 'belt' && c.read === 'yellow' && c.x < KIT.gates.yellow.x);
  if (!busy) assert.equal(sorter.gates.yellow.target, 0);
  assert.equal(sorter.gates.green.k, 0, '초록 게이트는 노랑 상자에 반응하지 않는다');
});

test('벨트 위 상자는 서로 겹치지 않는다(게이트에 밀려 느려져도 상자 폭 이상 간격)', () => {
  const sorter = new Sorter({ random: seeded(9) });
  for (let i = 0; i < 120 * 60; i++) {
    sorter.step(1 / 60);
    const xs = sorter.cubes.filter(c => c.state === 'belt').map(c => c.x).sort((a, b) => a - b);
    for (let k = 1; k < xs.length; k++) assert.ok(xs[k] - xs[k - 1] > KIT.half * 2 + 0.02, `간격 ${xs[k] - xs[k - 1]}`);
  }
});
