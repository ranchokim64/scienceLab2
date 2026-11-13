import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Arrangement, arrangement } from '../engine/analysis';
import {
  addPart,
  bbox,
  countKind,
  deletePart,
  degree,
  flipBattery,
  partsAt,
  rigidGroup,
  rotatePart,
  snap,
  splitVertex,
  translate,
  updatePart,
} from '../engine/ops';
import { Solution } from '../engine/solver';
import { MATERIALS, MATERIAL_IDS, PART_NAME, PartKind, Vec, isRigid } from '../engine/types';
import { captureCircuit } from '../capture';
import { CircuitStore } from '../store';
import { FlowLayer } from './FlowLayer';
import { PartIcon, PartView, ViewMode } from './PartView';

export interface Highlight {
  parts: string[];
  vertices: string[];
}

interface Props {
  store: CircuitStore;
  sol: Solution;
  /** 꺼낼 수 있는 부품 개수. 없으면 모든 부품을 무제한으로 */
  limits?: Partial<Record<PartKind, number>>;
  showFlow: boolean;
  highlight?: Highlight | null;
  onBulbRemoved?: (before: Arrangement) => void;
  onActivate?: () => void;
  active?: boolean;
  label?: string;
  mode?: ViewMode;
  showNumbers?: boolean;
  /** 📸 기록하기: 회로 그림을 넘겨준다 */
  onCapture?: (image: string) => void;
}

type View = { x: number; y: number; k: number };
type Selection = { type: 'part' | 'vertex'; id: string } | null;

type Drag =
  | { type: 'new'; kind: PartKind; sx: number; sy: number }
  | { type: 'pan'; sx: number; sy: number; view0: View; moved: boolean }
  | { type: 'pinch'; d0: number; k0: number; world: Vec }
  | {
      type: 'move' | 'rotate';
      sx: number;
      sy: number;
      last: Vec;
      moved: boolean;
      vids: Set<string>;
      partId?: string;
      vertexId?: string;
      rotatePartId?: string;
    };

const KINDS: PartKind[] = ['battery', 'bulb', 'switch', 'wire', 'object', 'coil'];
const TAP_SLOP = 7;
const clampK = (k: number) => Math.min(2.5, Math.max(0.4, k));

export function Workspace(props: Props) {
  const { store, sol, limits, showFlow, highlight, onBulbRemoved, onActivate, active = true, label, mode = 'real', showNumbers, onCapture } = props;
  const { circuit } = store;
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [selection, setSelection] = useState<Selection>(null);
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Vec>());
  const storeRef = useRef(store);
  storeRef.current = store;

  const kinds = limits ? KINDS.filter((k) => k === 'wire' || (limits[k] ?? 0) > 0) : KINDS;
  const remaining = (k: PartKind) => {
    if (!limits || limits[k] === undefined) return Infinity;
    return Math.max(0, limits[k]! - countKind(circuit, k));
  };

  // 선택한 것이 사라지면 선택 해제
  const sel =
    selection &&
    ((selection.type === 'part' && circuit.parts.some((p) => p.id === selection.id)) ||
      (selection.type === 'vertex' && circuit.vertices[selection.id]))
      ? selection
      : null;
  const selPart = sel?.type === 'part' ? circuit.parts.find((p) => p.id === sel.id) : undefined;

  const toWorld = useCallback((cx: number, cy: number): Vec => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
  }, []);

  const fit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const box = bbox(storeRef.current.circuit);
    if (!box) {
      setView({ x: r.width / 2 - 320, y: r.height / 2 - 290, k: 1 });
      return;
    }
    const pad = 90;
    const w = box.maxX - box.minX + pad * 2;
    const h = box.maxY - box.minY + pad * 2;
    const k = clampK(Math.min(r.width / w, r.height / h, 1.3));
    setView({ x: r.width / 2 - ((box.minX + box.maxX) / 2) * k, y: r.height / 2 - ((box.minY + box.maxY) / 2) * k, k });
  }, []);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  const zoomAt = (factor: number, sx?: number, sy?: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const px = sx ?? r.width / 2;
    const py = sy ?? r.height / 2;
    setView((v) => {
      const k = clampK(v.k * factor);
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  };

  // 크롬북 터치패드·마우스 휠 확대/축소
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  /* ---------- 끌기 처리 ---------- */

  const finishDrag = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const st = storeRef.current;
    if (d.type === 'move' || d.type === 'rotate') {
      if (d.moved) {
        const moved = d.type === 'rotate' ? new Set([d.vertexId!]) : d.vids;
        st.update((c) => snap(c, moved), { history: false });
      } else if (d.partId) {
        setSelection({ type: 'part', id: d.partId });
        const p = st.circuit.parts.find((q) => q.id === d.partId);
        if (p?.kind === 'switch') st.update((c) => updatePart(c, p.id, { closed: !p.closed }));
      } else if (d.vertexId) {
        setSelection({ type: 'vertex', id: d.vertexId });
      }
    } else if (d.type === 'pan' && !d.moved) {
      setSelection(null);
    } else if (d.type === 'new') {
      // 끌지 않고 누르기만 했으면 화면 가운데에 놓는다.
      const r = svgRef.current!.getBoundingClientRect();
      const c = toWorld(r.left + r.width / 2, r.top + r.height / 2);
      const n = st.circuit.parts.length % 6;
      const pos = { x: c.x + n * 22 - 50, y: c.y + n * 22 - 50 };
      st.update((cur) => addPart(cur, d.kind, pos).circuit);
    }
  }, [toWorld]);

  const onMove = useCallback(
    (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = drag.current;
      if (!d) return;
      const st = storeRef.current;

      if (d.type === 'pinch') {
        const pts = [...pointers.current.values()];
        if (pts.length < 2) return;
        const r = svgRef.current!.getBoundingClientRect();
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mx = (pts[0].x + pts[1].x) / 2 - r.left;
        const my = (pts[0].y + pts[1].y) / 2 - r.top;
        const k = clampK((d.k0 * dist) / d.d0);
        setView({ k, x: mx - d.world.x * k, y: my - d.world.y * k });
        return;
      }

      const far = Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > TAP_SLOP;

      if (d.type === 'new') {
        if (!far) return;
        const r = svgRef.current!.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
        const w = toWorld(e.clientX, e.clientY);
        const res = addPart(st.circuit, d.kind, w);
        const part = res.circuit.parts.find((p) => p.id === res.partId)!;
        st.update(() => res.circuit);
        drag.current = { type: 'move', sx: d.sx, sy: d.sy, last: w, moved: true, vids: new Set([part.a, part.b]), partId: part.id };
        setSelection({ type: 'part', id: part.id });
        return;
      }

      if (d.type === 'pan') {
        if (!d.moved && !far) return;
        d.moved = true;
        setView({ ...d.view0, x: d.view0.x + e.clientX - d.sx, y: d.view0.y + e.clientY - d.sy });
        return;
      }

      if (!d.moved && !far) return;
      const w = toWorld(e.clientX, e.clientY);
      const first = !d.moved;
      d.moved = true;
      if (d.type === 'rotate') {
        st.update((c) => rotatePart(c, d.rotatePartId!, d.vertexId!, w), { history: first });
      } else {
        const dx = w.x - d.last.x;
        const dy = w.y - d.last.y;
        st.update((c) => translate(c, d.vids, dx, dy), { history: first });
      }
      d.last = w;
    },
    [toWorld],
  );

  const onUp = useCallback(
    (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (drag.current?.type === 'pinch') {
        if (pointers.current.size === 0) drag.current = null;
        return;
      }
      if (pointers.current.size === 0) finishDrag();
    },
    [finishDrag],
  );

  useEffect(() => {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onMove, onUp]);

  const onSvgDown = (e: React.PointerEvent) => {
    onActivate?.();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 두 손가락: 확대/축소
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const r = svgRef.current!.getBoundingClientRect();
      const v = viewRef.current;
      const mx = (pts[0].x + pts[1].x) / 2 - r.left;
      const my = (pts[0].y + pts[1].y) / 2 - r.top;
      // 한 손가락으로 부품을 옮기던 중이었다면 그 위치에서 멈추고 확대로 바꾼다.
      const d = drag.current;
      if (d && (d.type === 'move' || d.type === 'rotate') && d.moved) {
        const moved = d.type === 'rotate' ? new Set([d.vertexId!]) : d.vids;
        storeRef.current.update((c) => snap(c, moved), { history: false });
      }
      drag.current = {
        type: 'pinch',
        d0: Math.max(10, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)),
        k0: v.k,
        world: { x: (mx - v.x) / v.k, y: (my - v.y) / v.k },
      };
      return;
    }
    if (pointers.current.size > 2) return;

    const target = e.target as Element;
    const vEl = target.closest('[data-vertex]');
    const pEl = target.closest('[data-part]');
    const w = toWorld(e.clientX, e.clientY);
    const c = storeRef.current.circuit;

    if (vEl) {
      const vid = vEl.getAttribute('data-vertex')!;
      const rigid = partsAt(c, vid).filter((p) => isRigid(p.kind));
      if (rigid.length === 1) {
        drag.current = { type: 'rotate', sx: e.clientX, sy: e.clientY, last: w, moved: false, vids: new Set([vid]), vertexId: vid, rotatePartId: rigid[0].id };
      } else {
        drag.current = { type: 'move', sx: e.clientX, sy: e.clientY, last: w, moved: false, vids: rigid.length ? rigidGroup(c, [vid]) : new Set([vid]), vertexId: vid };
      }
    } else if (pEl) {
      const pid = pEl.getAttribute('data-part')!;
      const p = c.parts.find((q) => q.id === pid)!;
      drag.current = { type: 'move', sx: e.clientX, sy: e.clientY, last: w, moved: false, vids: rigidGroup(c, [p.a, p.b]), partId: pid };
    } else {
      drag.current = { type: 'pan', sx: e.clientX, sy: e.clientY, view0: viewRef.current, moved: false };
    }
  };

  const onTrayDown = (kind: PartKind) => (e: React.PointerEvent) => {
    if (remaining(kind) <= 0) return;
    e.preventDefault();
    onActivate?.();
    pointers.current.clear();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // 손을 떼면 pointerup이 버튼에 묶이지 않도록 캡처를 푼다.
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = { type: 'new', kind, sx: e.clientX, sy: e.clientY };
  };

  /* ---------- 선택 도구 ---------- */

  const removeSelected = useCallback(() => {
    if (sel?.type === 'part') {
      store.update((c) => deletePart(c, sel.id));
      setSelection(null);
    }
  }, [sel, store]);

  const toggleBulb = () => {
    if (!selPart || selPart.kind !== 'bulb') return;
    if (!selPart.removed) onBulbRemoved?.(arrangement(circuit, sol));
    store.update((c) => updatePart(c, selPart.id, { removed: !selPart.removed }));
  };

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel?.type === 'part') {
        e.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, sel, removeSelected]);

  const hlParts = useMemo(() => new Set(highlight?.parts ?? []), [highlight]);
  const hlVerts = useMemo(() => new Set(highlight?.vertices ?? []), [highlight]);

  return (
    <div className={`workspace ${active ? 'active' : ''}`}>
      <div className="ws-inner">
      <div className="tray" role="toolbar" aria-label="부품 상자">
        <div className="tray-title">부품 상자</div>
        {kinds.map((k) => {
          const left = remaining(k);
          return (
            <button
              key={k}
              className="tray-item"
              disabled={left <= 0}
              onPointerDown={onTrayDown(k)}
              aria-label={`${PART_NAME[k]} 꺼내기`}
              data-kind={k}
            >
              <PartIcon kind={k} />
              <span className="tray-label">{PART_NAME[k]}</span>
              {left !== Infinity && <span className="badge">{left}</span>}
            </button>
          );
        })}
        <div className="tray-tip">끌어다 놓거나 눌러서 꺼내요</div>
      </div>

      <div className="canvas-wrap">
        {label && <div className="canvas-label">{label}</div>}
        <svg ref={svgRef} className="canvas" onPointerDown={onSvgDown} role="application" aria-label="회로 만들기 판">
          <defs>
            <radialGradient id="glow">
              <stop offset="0%" stopColor="#fff7b0" stopOpacity="1" />
              <stop offset="45%" stopColor="#ffe066" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#ffd43b" stopOpacity="0" />
            </radialGradient>
            <pattern id="grid" width={30 * view.k} height={30 * view.k} patternUnits="userSpaceOnUse" x={view.x} y={view.y}>
              <circle cx={1.5} cy={1.5} r={1.4} fill="#cfd8e6" />
            </pattern>
          </defs>
          <rect data-bg width="100%" height="100%" fill="url(#grid)" />
          <g data-world transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {[...circuit.parts]
              .sort((p, q) => Number(p.kind !== 'wire') - Number(q.kind !== 'wire'))
              .map((p) => (
                <PartView
                  key={p.id}
                  part={p}
                  a={circuit.vertices[p.a]}
                  b={circuit.vertices[p.b]}
                  brightness={sol.brightness[p.id] ?? 0}
                  current={sol.current[p.id]}
                  magnet={sol.magnet[p.id]}
                  mode={mode}
                  showNumbers={showNumbers}
                  hot={sol.hot.has(p.id)}
                  selected={sel?.type === 'part' && sel.id === p.id}
                  highlighted={hlParts.has(p.id)}
                />
              ))}
            {showFlow && <FlowLayer circuit={circuit} sol={sol} />}
            {Object.values(circuit.vertices).map((v) => {
              const d = degree(circuit, v.id);
              const selected = sel?.type === 'vertex' && sel.id === v.id;
              return (
                <g key={v.id} className={`vertex ${d > 1 ? 'joined' : 'loose'} ${selected ? 'sel' : ''}`} data-vertex={v.id}>
                  {hlVerts.has(v.id) && <circle className="hl-dot" cx={v.x} cy={v.y} r={18} />}
                  <circle className="vertex-dot" cx={v.x} cy={v.y} r={d > 1 ? 6 : 8} />
                  <circle className="hit" cx={v.x} cy={v.y} r={22} />
                </g>
              );
            })}
          </g>
        </svg>

        {sol.short && (
          <div className="banner danger" role="alert">
            ⚠️ <b>합선!</b> 전지의 두 극이 전선으로 바로 이어졌어요. 실제로 하면 전선이 뜨거워져 위험해요.
          </div>
        )}

        {sel && (
          <div className="sel-toolbar" onPointerDown={(e) => e.stopPropagation()}>
            {selPart && <span className="sel-name">{PART_NAME[selPart.kind]}</span>}
            {selPart?.kind === 'switch' && (
              <button onClick={() => store.update((c) => updatePart(c, selPart.id, { closed: !selPart.closed }))}>
                {selPart.closed ? '🔓 스위치 열기' : '🔒 스위치 닫기'}
              </button>
            )}
            {selPart?.kind === 'bulb' && <button onClick={toggleBulb}>{selPart.removed ? '💡 전구 끼우기' : '🫳 전구 빼기'}</button>}
            {selPart?.kind === 'battery' && <button onClick={() => store.update((c) => flipBattery(c, selPart.id))}>🔄 방향 바꾸기</button>}
            {selPart?.kind === 'object' && (
              <div className="material-picker" role="group" aria-label="물체 바꾸기">
                {MATERIAL_IDS.map((m) => (
                  <button
                    key={m}
                    className={selPart.material === m ? 'picked' : ''}
                    onClick={() => store.update((c) => updatePart(c, selPart.id, { material: m }))}
                  >
                    {MATERIALS[m].name}
                  </button>
                ))}
              </div>
            )}
            {selPart?.kind === 'coil' && (
              <button onClick={() => store.update((c) => updatePart(c, selPart.id, { turns: selPart.turns === 2 ? 1 : 2 }))}>
                {selPart.turns === 2 ? '🌀 코일 적게 감기' : '🌀 코일 많이 감기'}
              </button>
            )}
            {selPart?.kind === 'coil' && <button onClick={() => store.update((c) => flipBattery(c, selPart.id))}>🔄 감는 방향 바꾸기</button>}
            {selPart && (
              <button className="danger" onClick={removeSelected}>
                🗑 지우기
              </button>
            )}
            {sel.type === 'vertex' &&
              (degree(circuit, sel.id) > 1 ? (
                <button onClick={() => store.update((c) => splitVertex(c, sel.id))}>✂️ 연결 떼기</button>
              ) : (
                <span className="sel-name">끝을 끌어서 다른 부품의 끝에 붙여요</span>
              ))}
            <button className="ghost" onClick={() => setSelection(null)} aria-label="선택 해제">
              ✕
            </button>
          </div>
        )}

        {onCapture && (
          <button
            className={`capture ${label ? 'below-label' : ''}`}
            disabled={!circuit.parts.length}
            onClick={async () => {
              const img = await captureCircuit(svgRef.current!, circuit);
              if (img) onCapture(img);
            }}
            aria-label="기록장에 회로 그림 저장"
          >
            📸<span> 기록하기</span>
          </button>
        )}

        <div className="zoom">
          <button onClick={() => zoomAt(1.2)} aria-label="확대">＋</button>
          <button onClick={() => zoomAt(1 / 1.2)} aria-label="축소">－</button>
          <button onClick={fit} aria-label="회로가 다 보이게">⤢</button>
        </div>
      </div>
      </div>
    </div>
  );
}
