import { describe, expect, it } from 'vitest';
import { isLit, litBulbs } from './engine/analysis';
import { solve } from './engine/solver';
import { MISSIONS } from './missions';
import { QUIZ, shuffled } from './quiz';

const opt = (qid: string, oid: string) => QUIZ.find((q) => q.id === qid)!.options.find((o) => o.id === oid)!.circuit!;

describe('스스로 확인하기 퀴즈', () => {
  it('모든 문제의 정답이 보기 안에 있고, 다시 해 볼 미션이 실제로 있다', () => {
    const ids = new Set(MISSIONS.map((m) => m.id));
    for (const q of QUIZ) {
      expect(q.options.some((o) => o.id === q.answer), q.id).toBe(true);
      if (q.mission) expect(ids.has(q.mission), q.id).toBe(true);
      if (q.kind === 'circuit') expect(q.options.every((o) => o.circuit), q.id).toBe(true);
    }
    expect(new Set(QUIZ.map((q) => q.id)).size).toBe(QUIZ.length);
  });

  it('회로 그림 정답은 실제 회로 계산과 맞는다: 불이 켜지는 회로', () => {
    const lit = (oid: string) => {
      const c = opt('light-circuit', oid);
      return litBulbs(c, solve(c)).length > 0;
    };
    expect(lit('loop')).toBe(true);
    expect(lit('same')).toBe(false);
    expect(lit('broken')).toBe(false);
  });

  it('회로 그림 정답은 실제 회로 계산과 맞는다: 더 밝은 회로', () => {
    const brightness = (oid: string) => {
      const c = opt('brighter', oid);
      const s = solve(c);
      const bulb = c.parts.find((p) => p.kind === 'bulb')!;
      expect(isLit(s, bulb.id)).toBe(true);
      return s.brightness[bulb.id];
    };
    expect(brightness('parallel')).toBeGreaterThan(brightness('series') * 2);
  });

  it('회로 그림 정답은 실제 회로 계산과 맞는다: 더 센 전자석', () => {
    const clips = (oid: string) => {
      const c = opt('magnet-stronger', oid);
      const s = solve(c);
      expect(s.short).toBe(false);
      return s.magnet[c.parts.find((p) => p.kind === 'coil')!.id].clips;
    };
    expect(clips('two')).toBeGreaterThan(clips('one'));
  });

  it('보기를 섞어도 같은 보기들이다', () => {
    const a = [1, 2, 3, 4];
    expect(shuffled(a, 7).sort()).toEqual(a);
  });
});
