import { Circuit, MATERIAL_IDS, MaterialId, Part, PartKind } from './engine/types';

const KIND_CODE: Record<PartKind, string> = { battery: 'b', bulb: 'l', switch: 's', wire: 'w', object: 'o', coil: 'c' };
const CODE_KIND = Object.fromEntries(Object.entries(KIND_CODE).map(([k, v]) => [v, k])) as Record<string, PartKind>;

/** 회로를 짧은 문자열로 바꾼다(링크에 넣기 위해). 좌표는 정수로, id는 번호로 줄인다. */
export function encodeCircuit(c: Circuit): string {
  const ids = Object.keys(c.vertices);
  const idx = new Map(ids.map((id, i) => [id, i]));
  const v = ids.map((id) => [Math.round(c.vertices[id].x), Math.round(c.vertices[id].y)]);
  const p = c.parts.map((part) => {
    const row: (string | number)[] = [KIND_CODE[part.kind], idx.get(part.a)!, idx.get(part.b)!];
    if (part.kind === 'switch') row.push(part.closed ? 1 : 0);
    if (part.kind === 'bulb') row.push(part.removed ? 1 : 0);
    if (part.kind === 'object') row.push(MATERIAL_IDS.indexOf(part.material ?? 'clip'));
    if (part.kind === 'coil') row.push(part.turns ?? 1);
    return row;
  });
  return toBase64Url(JSON.stringify({ v, p }));
}

export function decodeCircuit(s: string): Circuit | null {
  try {
    const { v, p } = JSON.parse(fromBase64Url(s)) as { v: [number, number][]; p: (string | number)[][] };
    const vertices: Circuit['vertices'] = {};
    v.forEach(([x, y], i) => (vertices[`v${i}`] = { id: `v${i}`, x, y }));
    const parts: Part[] = p.map((row, i) => {
      const kind = CODE_KIND[row[0] as string];
      if (!kind) throw new Error('bad kind');
      const part: Part = { id: `p${i}`, kind, a: `v${row[1]}`, b: `v${row[2]}` };
      if (!vertices[part.a] || !vertices[part.b]) throw new Error('bad vertex');
      if (kind === 'switch') part.closed = row[3] === 1;
      if (kind === 'bulb' && row[3] === 1) part.removed = true;
      if (kind === 'object') part.material = (MATERIAL_IDS[row[3] as number] ?? 'clip') as MaterialId;
      if (kind === 'coil') part.turns = row[3] === 2 ? 2 : 1;
      return part;
    });
    return { vertices, parts };
  } catch {
    return null;
  }
}

export interface ShareParams {
  /** 미션 id 또는 'free' */
  m?: string;
  /** 다른 미션·모드로 못 가게 잠금 */
  lock?: boolean;
  /** 전압·전류 숫자 보이기 */
  num?: boolean;
  /** 회로도 기호로 보기 */
  sym?: boolean;
  /** 시작 회로 */
  c?: string;
}

export function buildShareUrl(base: string, params: ShareParams): string {
  const q = new URLSearchParams();
  if (params.m) q.set('m', params.m);
  if (params.lock) q.set('lock', '1');
  if (params.num) q.set('num', '1');
  if (params.sym) q.set('sym', '1');
  if (params.c) q.set('c', params.c);
  return `${base}#${q.toString()}`;
}

export function parseShareHash(hash: string): ShareParams {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    m: q.get('m') ?? undefined,
    lock: q.get('lock') === '1',
    num: q.get('num') === '1',
    sym: q.get('sym') === '1',
    c: q.get('c') ?? undefined,
  };
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}
