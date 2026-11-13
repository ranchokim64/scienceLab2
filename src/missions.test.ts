import { describe, expect, it } from 'vitest';
import { arrangement } from './engine/analysis';
import { solve } from './engine/solver';
import { Circuit } from './engine/types';
import { MISSIONS } from './missions';
import { decodeCircuit, encodeCircuit } from './share';

const mission = (id: string) => MISSIONS.find((m) => m.id === id)!;
const ctx = (c: Circuit, observed = {}) => {
  const sol = solve(c);
  return { circuit: c, sol, arrangement: arrangement(c, sol), observed };
};
const setSwitch = (c: Circuit, id: string, closed: boolean): Circuit => ({
  ...c,
  parts: c.parts.map((p) => (p.id === id ? { ...p, closed } : p)),
});

describe('비상 교과서 차시 순서', () => {
  it('차시 순서대로 놓이고, 교과서 밖 활동은 맨 뒤에 있다', () => {
    expect(MISSIONS.map((m) => m.lesson.name)).toEqual([
      '2차시', '2차시', '3차시', '3차시', '3차시', '4차시', '4차시', '5~7차시', '5~7차시', '8~9차시', '더 해 보기',
    ]);
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });
});

describe('전기 절약 탐정', () => {
  const m = mission('saving');
  const start = m.preset!();

  it('처음에는 세 전등이 모두 병렬로 켜져 있고, 성공이 아니다', () => {
    const c = ctx(start);
    expect(Object.values(c.sol.brightness).filter((b) => b > 0.5)).toHaveLength(3);
    expect(c.sol.short).toBe(false);
    expect(m.check(c)).toBe(false);
  });

  it('공부방만 남기고 끄면 성공, 전지에서 나가는 전기도 줄어든다', () => {
    const before = Math.abs(solve(start).current.bat);
    const c = setSwitch(setSwitch(start, 's1', false), 's2', false);
    const after = Math.abs(solve(c).current.bat);
    expect(after).toBeLessThan(before / 2);
    expect(m.check(ctx(c))).toBe(true);
  });

  it('공부방 전등을 끄면 성공이 아니다', () => {
    const c = setSwitch(setSwitch(start, 's0', false), 's1', false);
    expect(m.check(ctx(c))).toBe(false);
  });

  it('이름표가 링크 공유에도 남는다', () => {
    const back = decodeCircuit(encodeCircuit(start))!;
    expect(back.parts.filter((p) => p.label).map((p) => p.label)).toEqual(['공부방', '거실', '화장실']);
  });
});

describe('카드 설계', () => {
  const m = mission('card');
  const c: Circuit = {
    vertices: { n: { id: 'n', x: 0, y: 0 }, p: { id: 'p', x: 120, y: 0 }, x: { id: 'x', x: 200, y: 0 } },
    parts: [
      { id: 'b', kind: 'battery', a: 'n', b: 'p' },
      { id: 's', kind: 'switch', a: 'p', b: 'x', closed: true },
      { id: 'l', kind: 'bulb', a: 'x', b: 'n' },
    ],
  };
  it('불이 켜진 설계도를 기록장에 저장해야 성공', () => {
    expect(m.check(ctx(c))).toBe(false);
    expect(m.check(ctx(c, { captured: true }))).toBe(true);
    expect(m.check(ctx(setSwitch(c, 's', false), { captured: true }))).toBe(false);
  });
});
