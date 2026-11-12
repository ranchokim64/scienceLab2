import { describe, expect, it } from 'vitest';
import { arrangement, diagnose } from './analysis';
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
