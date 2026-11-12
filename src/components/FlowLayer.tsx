import { useEffect, useState } from 'react';
import { Solution, BATTERY_VOLTAGE, BULB_R, BATTERY_INTERNAL_R } from '../engine/solver';
import { Circuit } from '../engine/types';

const REF_I = BATTERY_VOLTAGE / (BULB_R + BATTERY_INTERNAL_R);
const SPACING = 26;

/** 전기가 흐르는 방향과 세기를 움직이는 점으로 보여 준다. 점이 빠를수록 전기가 세게 흐른다. */
export function FlowLayer({ circuit, sol }: { circuit: Circuit; sol: Solution }) {
  const [t, setT] = useState(0);
  const flowing = circuit.parts.some((p) => Math.abs(sol.current[p.id] ?? 0) > 0.003);

  useEffect(() => {
    if (!flowing) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flowing]);

  if (!flowing) return null;
  const dots: JSX.Element[] = [];
  for (const p of circuit.parts) {
    const I = sol.current[p.id] ?? 0;
    if (Math.abs(I) <= 0.003) continue;
    const a = circuit.vertices[p.a];
    const b = circuit.vertices[p.b];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) continue;
    const speed = Math.min(260, Math.max(14, (Math.abs(I) / REF_I) * 55));
    const shift = (((t * speed) % SPACING) + SPACING) % SPACING;
    let k = 0;
    for (let s = shift; s < len; s += SPACING, k++) {
      const d = I > 0 ? s : len - s;
      dots.push(
        <circle key={`${p.id}-${k}`} className="flow-dot" cx={a.x + ((b.x - a.x) * d) / len} cy={a.y + ((b.y - a.y) * d) / len} r={4} />,
      );
    }
  }
  return <g pointerEvents="none">{dots}</g>;
}
