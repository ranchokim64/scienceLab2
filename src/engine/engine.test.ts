import { describe, expect, it } from 'vitest';
import { arrangement, diagnose, eul, iga, testedObjects } from './analysis';
import { buildShareUrl, decodeCircuit, encodeCircuit, parseShareHash } from '../share';
import { snap, splitVertex, translate } from './ops';
import { solve, stars } from './solver';
import { Circuit, Part } from './types';

/** 꼭짓점 이름과 부품 목록으로 회로를 간단히 만든다. */
function make(parts: [Part['kind'], string, string, Partial<Part>?][]): Circuit {
  const vertices: Circuit['vertices'] = {};
  const ps: Part[] = parts.map(([kind, a, b, extra], i) => {
    for (const v of [a, b]) vertices[v] ??= { id: v, x: Object.keys(vertices).length * 50, y: 0 };
    return { id: `${kind}${i}`, kind, a, b, ...extra };
  });
  return { vertices, parts: ps };
}

describe('solver', () => {
  it('전지 1 + 전구 1 = 기준 밝기(별 3개)', () => {
    const c = make([['battery', 'n', 'p'], ['wire', 'p', 'x'], ['bulb', 'x', 'y'], ['wire', 'y', 'n']]);
    const s = solve(c);
    expect(s.brightness.bulb2).toBeCloseTo(1, 2);
    expect(stars(s.brightness.bulb2)).toBe(3);
    expect(s.short).toBe(false);
  });

  it('직렬은 어둡고 병렬은 기준과 비슷하다', () => {
    const series = make([['battery', 'n', 'p'], ['bulb', 'p', 'm'], ['bulb', 'm', 'n']]);
    const s1 = solve(series);
    expect(stars(s1.brightness.bulb1)).toBe(1);
    expect(arrangement(series, s1)).toBe('series');

    const parallel = make([['battery', 'n', 'p'], ['bulb', 'p', 'n'], ['wire', 'p', 'q'], ['wire', 'n', 'r'], ['bulb', 'q', 'r']]);
    const s2 = solve(parallel);
    expect(stars(s2.brightness.bulb1)).toBe(3);
    expect(stars(s2.brightness.bulb4)).toBe(3);
    expect(arrangement(parallel, s2)).toBe('parallel');
  });

  it('직렬에서 하나를 빼면 모두 꺼지고, 병렬에서는 나머지가 켜져 있다', () => {
    const series = make([['battery', 'n', 'p'], ['bulb', 'p', 'm', { removed: true }], ['bulb', 'm', 'n']]);
    expect(solve(series).brightness.bulb2).toBe(0);
    const parallel = make([['battery', 'n', 'p'], ['bulb', 'p', 'n', { removed: true }], ['bulb', 'p', 'n']]);
    expect(stars(solve(parallel).brightness.bulb2)).toBe(3);
  });

  it('전지 두 극을 전선으로 이으면 합선', () => {
    const c = make([['battery', 'n', 'p'], ['bulb', 'p', 'n'], ['wire', 'p', 'n']]);
    const s = solve(c);
    expect(s.short).toBe(true);
    expect(s.hot.has('wire2')).toBe(true);
    expect(diagnose(c, s).tone).toBe('danger');
  });

  it('열린 스위치를 찾아 준다', () => {
    const c = make([['battery', 'n', 'p'], ['switch', 'p', 'x', { closed: false }], ['bulb', 'x', 'n']]);
    const h = diagnose(c, solve(c));
    expect(h.question).toContain('스위치');
    expect(h.parts).toEqual(['switch1']);
  });

  it('연결되지 않은 전지 끝을 찾아 준다', () => {
    const c = make([['battery', 'n', 'p'], ['wire', 'p', 'x'], ['bulb', 'x', 'y']]);
    const h = diagnose(c, solve(c));
    expect(h.vertices).toContain('n');
  });

  it('반대로 놓인 전지를 찾아 준다', () => {
    const c = make([['battery', 'n', 'm'], ['battery', 'p', 'm'], ['bulb', 'p', 'n']]);
    const h = diagnose(c, solve(c));
    expect(h.question).toContain('방향');
  });
});

describe('ops', () => {
  it('가까운 끝은 붙고, 떼어 내면 다시 나뉜다', () => {
    let c: Circuit = {
      vertices: { a: { id: 'a', x: 0, y: 0 }, b: { id: 'b', x: 100, y: 0 }, c: { id: 'c', x: 110, y: 5 }, d: { id: 'd', x: 250, y: 5 } },
      parts: [
        { id: 'w1', kind: 'wire', a: 'a', b: 'b' },
        { id: 'w2', kind: 'wire', a: 'c', b: 'd' },
      ],
    };
    c = snap(translate(c, new Set(['c']), 0, 0), new Set(['c']));
    expect(c.parts[1].a).toBe('b');
    expect(Object.keys(c.vertices)).toHaveLength(3);
    c = splitVertex(c, 'b');
    expect(Object.keys(c.vertices)).toHaveLength(4);
  });
});

describe('2단계: 물체·전자석', () => {
  it('금속 물체는 전기가 통하고, 지우개는 통하지 않는다', () => {
    const metal = make([['battery', 'n', 'p'], ['object', 'p', 'x', { material: 'coin' }], ['bulb', 'x', 'n']]);
    expect(stars(solve(metal).brightness.bulb2)).toBe(3);
    expect(testedObjects(metal)).toEqual([{ material: 'coin', conducts: true }]);
    const rubber = make([['battery', 'n', 'p'], ['object', 'p', 'x', { material: 'eraser' }], ['bulb', 'x', 'n']]);
    expect(solve(rubber).brightness.bulb2).toBe(0);
    expect(testedObjects(rubber)).toEqual([{ material: 'eraser', conducts: false }]);
    expect(diagnose(rubber, solve(rubber)).question).toContain('물체');
  });

  it('검사 자리에 있지 않은 물체는 기록하지 않는다', () => {
    const c = make([['battery', 'n', 'p'], ['bulb', 'p', 'n'], ['object', 'x', 'y', { material: 'clip' }]]);
    expect(testedObjects(c)).toEqual([]);
  });

  it('전자석: 코일을 많이 감거나 전지를 직렬로 늘리면 세지고, 전지 방향을 바꾸면 극이 바뀐다', () => {
    const one = make([['battery', 'n', 'p'], ['coil', 'p', 'n', { turns: 1 }]]);
    const s1 = solve(one);
    expect(s1.magnet.coil1.clips).toBe(3);
    expect(s1.short).toBe(false);
    const more = make([['battery', 'n', 'p'], ['coil', 'p', 'n', { turns: 2 }]]);
    expect(solve(more).magnet.coil1.clips).toBe(6);
    const two = make([['battery', 'n', 'm'], ['battery', 'm', 'p'], ['coil', 'p', 'n', { turns: 1 }]]);
    const s2 = solve(two);
    expect(s2.magnet.coil2.clips).toBe(6);
    expect(s2.short).toBe(false);
    const flipped = make([['battery', 'p', 'n'], ['coil', 'p', 'n', { turns: 1 }]]);
    expect(solve(flipped).magnet.coil1.pole).toBe(-s1.magnet.coil1.pole);
  });

  it('스위치를 열면 전자석이 자석의 성질을 잃는다', () => {
    const c = make([['battery', 'n', 'p'], ['switch', 'p', 'x', { closed: false }], ['coil', 'x', 'n']]);
    const s = solve(c);
    expect(s.magnet.coil2.clips).toBe(0);
    expect(diagnose(c, s).question).toContain('스위치');
  });

  it('조사가 받침에 맞게 붙는다', () => {
    expect(eul('전구')).toBe('전구를');
    expect(eul('전자석')).toBe('전자석을');
    expect(iga('전자석')).toBe('전자석이');
  });
});

describe('링크 공유', () => {
  it('회로를 링크로 바꿨다가 그대로 되살린다', () => {
    const c = make([
      ['battery', 'n', 'p'],
      ['switch', 'p', 'x', { closed: true }],
      ['object', 'x', 'y', { material: 'ruler' }],
      ['coil', 'y', 'z', { turns: 2 }],
      ['bulb', 'z', 'n', { removed: true }],
    ]);
    const back = decodeCircuit(encodeCircuit(c))!;
    expect(back.parts.map((p) => [p.kind, p.closed, p.material, p.turns, p.removed])).toEqual(
      c.parts.map((p) => [p.kind, p.closed, p.material, p.turns, p.removed]),
    );
    expect(Object.keys(back.vertices)).toHaveLength(Object.keys(c.vertices).length);
    expect(stars(solve(back).brightness.bulb4 ?? 0)).toBe(0);
  });

  it('잘못된 링크는 무시한다', () => {
    expect(decodeCircuit('엉망')).toBeNull();
    expect(decodeCircuit('eyJ2IjpbXSwicCI6W1sieiIsMCwxXV19')).toBeNull();
  });

  it('링크 주소를 만들고 읽는다', () => {
    const url = buildShareUrl('https://x.io/app/', { m: 'series', lock: true, num: true });
    expect(parseShareHash(new URL(url).hash)).toMatchObject({ m: 'series', lock: true, num: true, sym: false });
  });
});
