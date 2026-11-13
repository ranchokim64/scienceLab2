import { Circuit, Part, PartKind, PART_LENGTH, Vec, isRigid } from './types';

let counter = 0;
export const uid = (p: string) =>
  `${p}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const SNAP_DISTANCE = 28;

export function partsAt(c: Circuit, vid: string): Part[] {
  return c.parts.filter((p) => p.a === vid || p.b === vid);
}

export function degree(c: Circuit, vid: string): number {
  return partsAt(c, vid).length;
}

export function countKind(c: Circuit, kind: PartKind): number {
  return c.parts.filter((p) => p.kind === kind).length;
}

export function addPart(c: Circuit, kind: PartKind, center: Vec, angle = 0): { circuit: Circuit; partId: string } {
  const L = PART_LENGTH[kind];
  const dx = (Math.cos(angle) * L) / 2;
  const dy = (Math.sin(angle) * L) / 2;
  const a = { id: uid('v'), x: center.x - dx, y: center.y - dy };
  const b = { id: uid('v'), x: center.x + dx, y: center.y + dy };
  const part: Part = { id: uid('p'), kind, a: a.id, b: b.id };
  if (kind === 'switch') part.closed = false;
  if (kind === 'object') part.material = 'clip';
  if (kind === 'coil') part.turns = 1;
  return {
    circuit: { vertices: { ...c.vertices, [a.id]: a, [b.id]: b }, parts: [...c.parts, part] },
    partId: part.id,
  };
}

/** 단단한 부품(전지·전구·스위치)으로 이어진 꼭짓점 묶음. 함께 움직여야 모양이 유지된다. */
export function rigidGroup(c: Circuit, start: string[]): Set<string> {
  const seen = new Set(start);
  const queue = [...start];
  while (queue.length) {
    const v = queue.pop()!;
    for (const p of partsAt(c, v)) {
      if (!isRigid(p.kind)) continue;
      const other = p.a === v ? p.b : p.a;
      if (!seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    }
  }
  return seen;
}

export function translate(c: Circuit, vids: Set<string>, dx: number, dy: number): Circuit {
  const vertices = { ...c.vertices };
  for (const id of vids) {
    const v = vertices[id];
    if (v) vertices[id] = { ...v, x: v.x + dx, y: v.y + dy };
  }
  return { ...c, vertices };
}

export function moveVertex(c: Circuit, vid: string, to: Vec): Circuit {
  const v = c.vertices[vid];
  if (!v) return c;
  return { ...c, vertices: { ...c.vertices, [vid]: { ...v, x: to.x, y: to.y } } };
}

/** 단단한 부품의 한쪽 끝을 끌면 다른 끝을 중심으로 회전한다. */
export function rotatePart(c: Circuit, partId: string, movingVid: string, toward: Vec): Circuit {
  const p = c.parts.find((q) => q.id === partId);
  if (!p) return c;
  const pivotId = p.a === movingVid ? p.b : p.a;
  const pivot = c.vertices[pivotId];
  const L = PART_LENGTH[p.kind];
  const ang = Math.atan2(toward.y - pivot.y, toward.x - pivot.x);
  return moveVertex(c, movingVid, { x: pivot.x + Math.cos(ang) * L, y: pivot.y + Math.sin(ang) * L });
}

function shareAPart(c: Circuit, v1: string, v2: string): boolean {
  return c.parts.some((p) => (p.a === v1 && p.b === v2) || (p.a === v2 && p.b === v1));
}

function mergeVertex(c: Circuit, from: string, into: string): Circuit {
  const parts = c.parts.map((p) => ({
    ...p,
    a: p.a === from ? into : p.a,
    b: p.b === from ? into : p.b,
  }));
  const vertices = { ...c.vertices };
  delete vertices[from];
  return { vertices, parts };
}

/** 움직인 꼭짓점이 다른 꼭짓점 가까이에 놓이면 붙인다(연결). */
export function snap(c: Circuit, moved: Set<string>): Circuit {
  let best: { from: string; into: string; d: number } | null = null;
  for (const id of moved) {
    const v = c.vertices[id];
    if (!v) continue;
    for (const w of Object.values(c.vertices)) {
      if (moved.has(w.id) || shareAPart(c, id, w.id)) continue;
      const d = Math.hypot(v.x - w.x, v.y - w.y);
      if (d < SNAP_DISTANCE && (!best || d < best.d)) best = { from: id, into: w.id, d };
    }
  }
  if (!best) return c;
  const src = c.vertices[best.from];
  const dst = c.vertices[best.into];
  let out = translate(c, moved, dst.x - src.x, dst.y - src.y);
  out = mergeVertex(out, best.from, best.into);
  // 같은 움직임으로 다른 끝도 정확히 겹쳤다면 함께 붙인다.
  for (const id of moved) {
    const v = out.vertices[id];
    if (!v) continue;
    for (const w of Object.values(out.vertices)) {
      if (w.id === id || moved.has(w.id) || shareAPart(out, id, w.id)) continue;
      if (Math.hypot(v.x - w.x, v.y - w.y) < 3) {
        out = mergeVertex(out, id, w.id);
        break;
      }
    }
  }
  return out;
}

/** 연결된 꼭짓점을 부품마다 따로 떼어 낸다. */
export function splitVertex(c: Circuit, vid: string): Circuit {
  const attached = partsAt(c, vid);
  if (attached.length < 2) return c;
  let out = c;
  for (const ap of attached.slice(1)) {
    const origin = out.vertices[vid];
    const nvId = uid('v');
    out = {
      vertices: { ...out.vertices, [nvId]: { id: nvId, x: origin.x, y: origin.y } },
      parts: out.parts.map((p) =>
        p.id === ap.id ? { ...p, a: p.a === vid ? nvId : p.a, b: p.b === vid ? nvId : p.b } : p,
      ),
    };
    const p = out.parts.find((q) => q.id === ap.id)!;
    const other = out.vertices[p.a === nvId ? p.b : p.a];
    const len = Math.hypot(other.x - origin.x, other.y - origin.y) || 1;
    const ux = ((other.x - origin.x) / len) * 26;
    const uy = ((other.y - origin.y) / len) * 26;
    out = isRigid(p.kind)
      ? translate(out, rigidGroup(out, [nvId]), ux, uy)
      : moveVertex(out, nvId, { x: origin.x + ux, y: origin.y + uy });
  }
  return out;
}

function removeUnusedVertices(c: Circuit): Circuit {
  const used = new Set(c.parts.flatMap((p) => [p.a, p.b]));
  const vertices: Circuit['vertices'] = {};
  for (const v of Object.values(c.vertices)) if (used.has(v.id)) vertices[v.id] = v;
  return { ...c, vertices };
}

export function deletePart(c: Circuit, partId: string): Circuit {
  return removeUnusedVertices({ ...c, parts: c.parts.filter((p) => p.id !== partId) });
}

export function updatePart(c: Circuit, partId: string, patch: Partial<Part>): Circuit {
  return { ...c, parts: c.parts.map((p) => (p.id === partId ? { ...p, ...patch } : p)) };
}

export function flipBattery(c: Circuit, partId: string): Circuit {
  const p = c.parts.find((q) => q.id === partId);
  if (!p) return c;
  return updatePart(c, partId, { a: p.b, b: p.a });
}

export function bbox(c: Circuit) {
  const vs = Object.values(c.vertices);
  if (!vs.length) return null;
  const xs = vs.map((v) => v.x);
  const ys = vs.map((v) => v.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}
