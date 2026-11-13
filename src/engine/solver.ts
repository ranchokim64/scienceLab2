import { Circuit, MATERIALS, Part } from './types';

export const BATTERY_VOLTAGE = 1.5;
export const BATTERY_INTERNAL_R = 0.1;
export const BULB_R = 10;
export const WIRE_R = 0.01;
/** 전자석(에나멜선 코일)의 저항 */
export const COIL_R = 2;
/** 전기가 통하는 물체의 저항 */
export const CONDUCTOR_R = 0.05;
/** 이 전류보다 크면 합선(전지의 두 극이 저항 없이 이어짐)으로 본다. */
export const SHORT_CURRENT = 2.5;
/** 코일 1단(적게 감음) + 전지 1개일 때 끌어당기는 클립 수 */
const REF_CLIPS = 3;
const REF_MAGNET = BATTERY_VOLTAGE / (COIL_R + BATTERY_INTERNAL_R);
/** 전지 1개 + 전구 1개일 때 전구의 전력 = 밝기의 기준(1.0) */
export const REFERENCE_POWER = (BATTERY_VOLTAGE / (BULB_R + BATTERY_INTERNAL_R)) ** 2 * BULB_R;
export const LIT_THRESHOLD = 0.03;

export interface Solution {
  /** 부품 안에서 a → b 방향으로 흐르는 전류(A) */
  current: Record<string, number>;
  /** 꼭짓점 전위(V) */
  voltage: Record<string, number>;
  /** 전구 밝기 (기준 = 1) */
  brightness: Record<string, number>;
  short: boolean;
  /** 지나치게 큰 전류가 흐르는 부품(뜨거워짐) */
  hot: Set<string>;
  /** 전자석: 끌어당기는 클립 수와 극(+1: 끝이 N극, -1: 끝이 S극, 0: 자석 아님) */
  magnet: Record<string, { clips: number; pole: 1 | -1 | 0 }>;
}

export function conductance(p: Pick<Part, 'kind' | 'closed' | 'removed' | 'material'>): number {
  switch (p.kind) {
    case 'wire':
      return 1 / WIRE_R;
    case 'switch':
      return p.closed ? 1 / WIRE_R : 0;
    case 'bulb':
      return p.removed ? 0 : 1 / BULB_R;
    case 'battery':
      return 1 / BATTERY_INTERNAL_R;
    case 'coil':
      return 1 / COIL_R;
    case 'object':
      return MATERIALS[p.material ?? 'clip'].conducts ? 1 / CONDUCTOR_R : 0;
    default:
      return 0;
  }
}

/** 직류 회로를 절점 해석법으로 푼다. 전지는 노턴 등가(전류원 + 내부 저항)로 바꾼다. */
export function solve(c: Circuit): Solution {
  const ids = Object.keys(c.vertices);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const G: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const J: number[] = new Array(n).fill(0);


  for (const p of c.parts) {
    const i = index.get(p.a);
    const j = index.get(p.b);
    if (i === undefined || j === undefined || i === j) continue;
    const g = conductance(p);
    if (g === 0) continue;
    G[i][i] += g;
    G[j][j] += g;
    G[i][j] -= g;
    G[j][i] -= g;
    if (p.kind === 'battery') {
      const src = BATTERY_VOLTAGE / BATTERY_INTERNAL_R;
      J[j] += src; // (+)극으로 들어간다
      J[i] -= src;
    }
  }
  // 떠 있는 꼭짓점 때문에 행렬이 특이해지지 않도록 아주 작은 접지 컨덕턴스를 둔다.
  for (let i = 0; i < n; i++) G[i][i] += 1e-9;

  const v = gaussian(G, J);
  const voltage: Record<string, number> = {};
  ids.forEach((id, i) => (voltage[id] = v[i] ?? 0));

  const current: Record<string, number> = {};
  const brightness: Record<string, number> = {};
  const hot = new Set<string>();
  const magnet: Solution['magnet'] = {};
  let short = false;

  for (const p of c.parts) {
    const va = voltage[p.a] ?? 0;
    const vb = voltage[p.b] ?? 0;
    const g = p.a === p.b ? 0 : conductance(p);
    let I: number;
    if (p.kind === 'battery') {
      I = p.a === p.b ? 0 : BATTERY_VOLTAGE / BATTERY_INTERNAL_R - (vb - va) / BATTERY_INTERNAL_R;
    } else {
      I = (va - vb) * g;
    }
    if (Math.abs(I) < 1e-6) I = 0;
    current[p.id] = I;
    if (p.kind === 'bulb') brightness[p.id] = (I * I * BULB_R) / REFERENCE_POWER;
    if (p.kind === 'coil') {
      const clips = Math.min(10, Math.round(((p.turns ?? 1) * Math.abs(I) * REF_CLIPS) / REF_MAGNET));
      magnet[p.id] = { clips, pole: clips === 0 ? 0 : I > 0 ? 1 : -1 };
    }
    if (Math.abs(I) > SHORT_CURRENT) {
      hot.add(p.id);
      if (p.kind === 'battery') short = true;
    }
  }
  if (!short) hot.clear();
  return { current, voltage, brightness, short, hot, magnet };
}

function gaussian(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-15) continue;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = Math.abs(M[r][r]) < 1e-15 ? 0 : s / M[r][r];
  }
  return x;
}

/** 밝기(기준 대비)를 별 0~5개로 바꾼다. 전구 1개 + 전지 1개 = 별 3개 */
export function stars(ratio: number): number {
  if (ratio < LIT_THRESHOLD) return 0;
  if (ratio < 0.4) return 1;
  if (ratio < 0.75) return 2;
  if (ratio < 1.5) return 3;
  if (ratio < 3) return 4;
  return 5;
}
