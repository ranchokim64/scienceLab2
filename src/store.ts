import { useCallback, useEffect, useRef, useState } from 'react';
import { Circuit, emptyCircuit } from './engine/types';

interface History {
  c: Circuit;
  past: Circuit[];
  future: Circuit[];
}

const STORAGE_PREFIX = 'banjjak-circuit:';

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장할 수 없는 환경이면 조용히 넘어간다 */
  }
}

export interface CircuitStore {
  circuit: Circuit;
  update: (fn: (c: Circuit) => Circuit, opts?: { history?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  reset: (c?: Circuit) => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** 여러 회로(미션별, 자유 실험, 비교)를 키별로 따로 보관한다. 되돌리기 기록과 자동 저장 포함. */
export function useCircuitStores(initialFor: (key: string) => Circuit) {
  const [all, setAll] = useState<Record<string, History>>({});

  const cache = useRef<Record<string, History>>({});
  const get = useCallback(
    (key: string, map: Record<string, History>): History =>
      map[key] ??
      (cache.current[key] ??= { c: loadJSON<Circuit | null>(`circuit:${key}`, null) ?? initialFor(key), past: [], future: [] }),
    [initialFor],
  );

  useEffect(() => {
    for (const [key, h] of Object.entries(all)) saveJSON(`circuit:${key}`, h.c);
  }, [all]);

  return useCallback(
    (key: string): CircuitStore => {
      const h = get(key, all);
      const set = (fn: (h: History) => History) => setAll((m) => ({ ...m, [key]: fn(get(key, m)) }));
      return {
        circuit: h.c,
        canUndo: h.past.length > 0,
        canRedo: h.future.length > 0,
        update: (fn, opts) =>
          set((cur) => {
            const next = fn(cur.c);
            if (next === cur.c) return cur;
            return opts?.history === false
              ? { ...cur, c: next }
              : { c: next, past: [...cur.past.slice(-60), cur.c], future: [] };
          }),
        undo: () =>
          set((cur) =>
            cur.past.length ? { c: cur.past[cur.past.length - 1], past: cur.past.slice(0, -1), future: [cur.c, ...cur.future] } : cur,
          ),
        redo: () =>
          set((cur) => (cur.future.length ? { c: cur.future[0], past: [...cur.past, cur.c], future: cur.future.slice(1) } : cur)),
        reset: (c) => set((cur) => ({ c: c ?? emptyCircuit(), past: [...cur.past, cur.c], future: [] })),
      };
    },
    [all, get],
  );
}
