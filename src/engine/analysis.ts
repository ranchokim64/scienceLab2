import { degree, partsAt } from './ops';
import { LIT_THRESHOLD, Solution, solve } from './solver';
import { Circuit, MATERIALS, MaterialId, PART_NAME, Part } from './types';

/** 받침이 있으면 true (조사 고르기용) */
const batchim = (w: string) => {
  const code = w.charCodeAt(w.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};
export const eul = (w: string) => w + (batchim(w) ? '을' : '를');
export const iga = (w: string) => w + (batchim(w) ? '이' : '가');
export const eunNeun = (w: string) => w + (batchim(w) ? '은' : '는');

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
    if (p.kind === 'wire' || (p.kind === 'switch' && p.closed) || (p.kind === 'object' && MATERIALS[p.material ?? 'clip'].conducts)) {
      parent.set(find(p.a), find(p.b));
    }
  }
  const out = new Map<string, string>();
  for (const id of Object.keys(c.vertices)) out.set(id, find(id));
  return out;
}

export const isLit = (sol: Solution, id: string) => (sol.brightness[id] ?? 0) >= LIT_THRESHOLD;

/** 전구는 불이 켜졌는지, 전자석은 전기가 흐르는지 */
export const isOn = (sol: Solution, p: Part) =>
  p.kind === 'coil' ? Math.abs(sol.current[p.id] ?? 0) > 0.01 : isLit(sol, p.id);

const isLoad = (p: Part) => p.kind === 'bulb' || p.kind === 'coil';

/**
 * 전기가 통하는지 검사하는 자리에 놓인 물체: 이 물체가 전기가 통하면 전구가 켜지고,
 * 통하지 않으면 꺼지는 자리. 결과로 그 물체가 전기가 통하는지를 돌려준다.
 */
export function testedObjects(c: Circuit): { material: MaterialId; conducts: boolean }[] {
  const out: { material: MaterialId; conducts: boolean }[] = [];
  for (const o of c.parts.filter((p) => p.kind === 'object')) {
    const withMaterial = (m: MaterialId) => {
      const alt = { ...c, parts: c.parts.map((p) => (p.id === o.id ? { ...p, material: m } : p)) };
      const s = solve(alt);
      return !s.short && litBulbs(alt, s).length > 0;
    };
    if (withMaterial('clip') && !withMaterial('eraser')) {
      const m = o.material ?? 'clip';
      out.push({ material: m, conducts: MATERIALS[m].conducts });
    }
  }
  return out;
}

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
  const loads = c.parts.filter(isLoad);

  if (batteries.length === 0) return hint('info', '전기를 보내 줄 것이 있나요?', '부품 상자에서 전지를 꺼내 놓아 보세요.');
  if (loads.length === 0) return hint('info', '불을 켤 전구가 있나요?', '부품 상자에서 전구(또는 전자석)를 꺼내 놓아 보세요.');

  if (sol.short) {
    return hint(
      'danger',
      '전구를 거치지 않고 전지의 두 극이 바로 이어진 곳이 있지 않나요?',
      '빨갛게 표시된 전선이 전지의 (+)극과 (−)극을 바로 잇고 있어요. 실제로 이렇게 하면 전선이 뜨거워지고 전지가 빨리 닳아 위험해요. 그 전선을 떼어 내세요.',
      [...sol.hot].filter((id) => c.parts.find((p) => p.id === id)?.kind !== 'battery'),
    );
  }

  const off = loads.filter((p) => !isOn(sol, p));
  if (off.length === 0) {
    return loads.some((p) => p.kind === 'bulb')
      ? hint('ok', '모든 전구에 불이 켜졌어요! 🎉', '전기가 끊어지지 않고 한 바퀴 도는 길(전기 회로)이 만들어졌어요.')
      : hint('ok', '전자석에 전기가 흐르고 있어요! 🧲', '전기가 흐르는 동안 철못이 자석이 되어 클립을 끌어당겨요.');
  }

  const target = off[0];
  const name = PART_NAME[target.kind];
  const verb = target.kind === 'bulb' ? '켜져' : '작동해';
  const relit = (alt: Circuit) => isOn(solve(alt), alt.parts.find((p) => p.id === target.id)!);
  const swap = (fn: (p: Part) => Part) => ({ ...c, parts: c.parts.map(fn) });

  if (target.removed) {
    return hint('warn', '전구가 끼우개에 잘 끼워져 있나요?', '전구가 빠져 있어요. 전구를 눌러 「전구 끼우기」를 해 보세요.', [target.id]);
  }

  const nodes = electricalNodes(c);
  if (nodes.get(target.a) === nodes.get(target.b)) {
    return hint(
      'warn',
      `전기가 ${eul(name)} 지나가지 않고 옆길로 빠져나가고 있지 않나요?`,
      `${name}의 양쪽 끝이 전선으로 바로 이어져 있어서 전기가 ${eul(name)} 거치지 않아요. ${name} 옆으로 지나가는 전선을 떼어 보세요.`,
      [target.id],
    );
  }

  const openSwitches = c.parts.filter((p) => p.kind === 'switch' && !p.closed);
  if (openSwitches.length && relit(swap((p) => (p.kind === 'switch' ? { ...p, closed: true } : p)))) {
    return hint('warn', '스위치가 닫혀 있나요?', '스위치가 열려 있어서 전기가 흐르는 길이 끊겼어요. 스위치를 눌러 닫아 보세요.', openSwitches.map((s) => s.id));
  }

  const removed = c.parts.filter((p) => p.kind === 'bulb' && p.removed);
  if (removed.length && relit(swap((p) => (p.kind === 'bulb' ? { ...p, removed: false } : p)))) {
    return hint('warn', '빠져 있는 전구가 있지 않나요?', '다른 전구가 빠져서 전기가 흐르는 길이 끊겼어요. 빠진 전구를 다시 끼워 보세요.', removed.map((s) => s.id));
  }

  const insulators = c.parts.filter((p) => p.kind === 'object' && !MATERIALS[p.material ?? 'clip'].conducts);
  if (insulators.length && relit(swap((p) => (p.kind === 'object' ? { ...p, material: 'clip' } : p)))) {
    return hint(
      'info',
      '길 중간에 놓인 물체는 전기가 통하는 물체인가요?',
      `${eunNeun(insulators.map((o) => MATERIALS[o.material ?? 'clip'].name).join(', '))} 전기가 통하지 않아서 전기가 흐르는 길이 막혔어요.`,
      insulators.map((o) => o.id),
    );
  }

  if (batteries.length > 1) {
    for (const b of batteries) {
      if (relit(swap((p) => (p.id === b.id ? { ...p, a: p.b, b: p.a } : p)))) {
        return hint('warn', '전지들이 같은 방향으로 놓여 있나요?', '전지 하나가 반대 방향으로 놓여 있어서 서로 방해하고 있어요. 전지를 눌러 「방향 바꾸기」를 해 보세요.', [b.id]);
      }
    }
  }

  const loose = Object.keys(c.vertices).filter((v) => degree(c, v) === 1);
  const looseOn = (kinds: string[]) => loose.filter((v) => kinds.includes(partsAt(c, v)[0].kind));
  const bt = looseOn(['battery']);
  if (bt.length) {
    return hint('warn', '전지의 (+)극과 (−)극에 모두 전선을 연결했나요?', '깜빡이는 전지의 끝에 아무것도 연결되어 있지 않아요.', [], bt);
  }
  const ld = looseOn(['bulb', 'coil', 'object', 'switch']);
  if (ld.length) {
    const k = PART_NAME[partsAt(c, ld[0])[0].kind as Part['kind']];
    return hint('warn', `${k}의 양쪽 끝에 모두 전선을 연결했나요?`, `깜빡이는 ${k}의 끝에 아무것도 연결되어 있지 않아요.`, [], ld);
  }
  if (loose.length) {
    return hint('warn', '끊어진 곳이 있지 않나요?', '깜빡이는 곳이 어디에도 연결되지 않은 끝이에요. 다른 부품의 끝에 가져다 붙여 보세요.', [], loose);
  }
  return hint(
    'info',
    `전지 → ${name} → 다시 전지로, 한 바퀴 도는 길이 있나요?`,
    `전지의 (+)극에서 나온 전기가 ${eul(name)} 지나 전지의 (−)극으로 돌아와야 ${iga(name)} ${verb}요. 끊어지지 않은 길을 만들어 보세요.`,
    [target.id],
  );
}
