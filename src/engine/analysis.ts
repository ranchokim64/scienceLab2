import { degree, partsAt } from './ops';
import { LIT_THRESHOLD, Solution, solve } from './solver';
import { Circuit, Part } from './types';

export type Arrangement = 'none' | 'single' | 'series' | 'parallel' | 'mixed';

/** 전선과 닫힌 스위치로 이어진 꼭짓점은 전기적으로 같은 점이다. */
export function electricalNodes(c: Circuit): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  for (const id of Object.keys(c.vertices)) parent.set(id, id);
  for (const p of c.parts) {
    if (p.kind === 'wire' || (p.kind === 'switch' && p.closed)) {
      parent.set(find(p.a), find(p.b));
    }
  }
  const out = new Map<string, string>();
  for (const id of Object.keys(c.vertices)) out.set(id, find(id));
  return out;
}

export const isLit = (sol: Solution, id: string) => (sol.brightness[id] ?? 0) >= LIT_THRESHOLD;

export function litBulbs(c: Circuit, sol: Solution): Part[] {
  return c.parts.filter((p) => p.kind === 'bulb' && isLit(sol, p.id));
}

/** 켜진 전구들이 직렬인지 병렬인지 판단한다. */
export function arrangement(c: Circuit, sol: Solution): Arrangement {
  const lit = litBulbs(c, sol);
  if (lit.length === 0) return 'none';
  if (lit.length === 1) return 'single';
  const nodes = electricalNodes(c);
  const pairKey = (p: Part) => [nodes.get(p.a), nodes.get(p.b)].sort().join('|');
  const keys = new Set(lit.map(pairKey));
  if (keys.size === 1) return 'parallel';
  const I0 = Math.abs(sol.current[lit[0].id]);
  const equal = lit.every((p) => Math.abs(Math.abs(sol.current[p.id]) - I0) / I0 < 0.02);
  if (equal && keys.size === lit.length) return 'series';
  return 'mixed';
}

export const ARRANGEMENT_NAME: Record<Arrangement, string> = {
  none: '켜진 전구 없음',
  single: '전구 1개',
  series: '직렬연결',
  parallel: '병렬연결',
  mixed: '직렬과 병렬이 섞인 연결',
};

export interface Hint {
  tone: 'ok' | 'info' | 'warn' | 'danger';
  /** 먼저 보여 주는 질문형 힌트 */
  question: string;
  /** "어디인지 보여줘"를 눌렀을 때의 설명 */
  detail: string;
  vertices: string[];
  parts: string[];
}

const hint = (tone: Hint['tone'], question: string, detail: string, parts: string[] = [], vertices: string[] = []): Hint => ({
  tone,
  question,
  detail,
  parts,
  vertices,
});

/** "왜 안 켜질까?" — 학생들이 자주 하는 실수를 순서대로 살핀다. */
export function diagnose(c: Circuit, sol: Solution): Hint {
  const batteries = c.parts.filter((p) => p.kind === 'battery');
  const bulbs = c.parts.filter((p) => p.kind === 'bulb');

  if (batteries.length === 0) return hint('info', '전기를 보내 줄 것이 있나요?', '부품 상자에서 전지를 꺼내 놓아 보세요.');
  if (bulbs.length === 0) return hint('info', '불을 켤 전구가 있나요?', '부품 상자에서 전구를 꺼내 놓아 보세요.');

  if (sol.short) {
    return hint(
      'danger',
      '전구를 거치지 않고 전지의 두 극이 바로 이어진 곳이 있지 않나요?',
      '빨갛게 표시된 전선이 전지의 (+)극과 (−)극을 바로 잇고 있어요. 실제로 이렇게 하면 전선이 뜨거워지고 전지가 빨리 닳아 위험해요. 그 전선을 떼어 내세요.',
      [...sol.hot].filter((id) => c.parts.find((p) => p.id === id)?.kind !== 'battery'),
    );
  }

  const dark = bulbs.filter((b) => !isLit(sol, b.id));
  if (dark.length === 0) return hint('ok', '모든 전구에 불이 켜졌어요! 🎉', '전기가 끊어지지 않고 한 바퀴 도는 길(전기 회로)이 만들어졌어요.');

  const target = dark[0];
  const relit = (alt: Circuit) => isLit(solve(alt), target.id);

  if (target.removed) {
    return hint('warn', '전구가 끼우개에 잘 끼워져 있나요?', '전구가 빠져 있어요. 전구를 눌러 「전구 끼우기」를 해 보세요.', [target.id]);
  }

  const nodes = electricalNodes(c);
  if (nodes.get(target.a) === nodes.get(target.b)) {
    return hint(
      'warn',
      '전기가 전구를 지나가지 않고 옆길로 빠져나가고 있지 않나요?',
      '전구의 양쪽 끝이 전선으로 바로 이어져 있어서 전기가 전구를 거치지 않아요. 전구 옆으로 지나가는 전선을 떼어 보세요.',
      [target.id],
    );
  }

  const openSwitches = c.parts.filter((p) => p.kind === 'switch' && !p.closed);
  if (openSwitches.length) {
    const alt = { ...c, parts: c.parts.map((p) => (p.kind === 'switch' ? { ...p, closed: true } : p)) };
    if (relit(alt)) {
      return hint('warn', '스위치가 닫혀 있나요?', '스위치가 열려 있어서 전기가 흐르는 길이 끊겼어요. 스위치를 눌러 닫아 보세요.', openSwitches.map((s) => s.id));
    }
  }

  const removed = c.parts.filter((p) => p.kind === 'bulb' && p.removed);
  if (removed.length) {
    const alt = { ...c, parts: c.parts.map((p) => (p.kind === 'bulb' ? { ...p, removed: false } : p)) };
    if (relit(alt)) {
      return hint('warn', '빠져 있는 전구가 있지 않나요?', '다른 전구가 빠져서 전기가 흐르는 길이 끊겼어요. 빠진 전구를 다시 끼워 보세요.', removed.map((s) => s.id));
    }
  }

  if (batteries.length > 1) {
    for (const b of batteries) {
      const alt = { ...c, parts: c.parts.map((p) => (p.id === b.id ? { ...p, a: p.b, b: p.a } : p)) };
      if (relit(alt)) {
        return hint('warn', '전지들이 같은 방향으로 놓여 있나요?', '전지 하나가 반대 방향으로 놓여 있어서 서로 방해하고 있어요. 전지를 눌러 「방향 바꾸기」를 해 보세요.', [b.id]);
      }
    }
  }

  const loose = Object.keys(c.vertices).filter((v) => degree(c, v) === 1);
  const looseOn = (kind: string) => loose.filter((v) => partsAt(c, v)[0].kind === kind);
  const bt = looseOn('battery');
  if (bt.length) {
    return hint('warn', '전지의 (+)극과 (−)극에 모두 전선을 연결했나요?', '깜빡이는 전지의 끝에 아무것도 연결되어 있지 않아요.', [], bt);
  }
  const bl = looseOn('bulb');
  if (bl.length) {
    return hint('warn', '전구의 양쪽 끝에 모두 전선을 연결했나요?', '깜빡이는 전구의 끝에 아무것도 연결되어 있지 않아요.', [], bl);
  }
  if (loose.length) {
    return hint('warn', '끊어진 곳이 있지 않나요?', '깜빡이는 곳이 어디에도 연결되지 않은 끝이에요. 다른 부품의 끝에 가져다 붙여 보세요.', [], loose);
  }
  return hint(
    'info',
    '전지 → 전구 → 다시 전지로, 한 바퀴 도는 길이 있나요?',
    '전지의 (+)극에서 나온 전기가 전구를 지나 전지의 (−)극으로 돌아오는 끊어지지 않은 길이 필요해요.',
    [target.id],
  );
}
