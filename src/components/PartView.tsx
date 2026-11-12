import { stars } from '../engine/solver';
import { Part, Vertex } from '../engine/types';

interface Props {
  part: Part;
  a: Vertex;
  b: Vertex;
  brightness: number;
  hot: boolean;
  selected: boolean;
  highlighted: boolean;
}

const deg = (r: number) => (r * 180) / Math.PI;

/** 회전한 부품 안에서도 글자가 똑바로 보이도록 되돌려 돌린다. */
function Upright({ x, y, angle, children }: { x: number; y: number; angle: number; children: React.ReactNode }) {
  return <g transform={`translate(${x} ${y}) rotate(${-deg(angle)})`}>{children}</g>;
}

export function PartView({ part, a, b, brightness, hot, selected, highlighted }: Props) {
  const cls = ['part', `part-${part.kind}`, selected && 'sel', highlighted && 'hl', hot && 'hot'].filter(Boolean).join(' ');

  if (part.kind === 'wire') {
    return (
      <g className={cls} data-part={part.id}>
        {selected && <line className="sel-ring" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
        {highlighted && <line className="hl-ring" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
        <line className="wire-outline" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <line className="wire-core" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        <line className="hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      </g>
    );
  }

  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const t = `translate(${a.x} ${a.y}) rotate(${deg(angle)})`;

  if (part.kind === 'battery') {
    return (
      <g className={cls} data-part={part.id} transform={t}>
        {selected && <rect className="sel-ring" x={-4} y={-26} width={L + 8} height={52} rx={14} />}
        {highlighted && <rect className="hl-ring" x={-4} y={-26} width={L + 8} height={52} rx={14} />}
        <line className="lead" x1={0} y1={0} x2={10} y2={0} />
        <line className="lead" x1={L - 10} y1={0} x2={L} y2={0} />
        <rect x={8} y={-18} width={L - 26} height={36} rx={6} fill="#2f3542" />
        <rect x={8 + (L - 26) * 0.62} y={-18} width={(L - 26) * 0.38} height={36} rx={6} fill="#f5b52e" />
        <rect x={8 + (L - 26) * 0.62} y={-18} width={6} height={36} fill="#f5b52e" />
        <rect x={L - 18} y={-8} width={8} height={16} rx={2} fill="#c9ccd3" />
        <rect x={10} y={-14} width={L - 30} height={6} rx={3} fill="#ffffff" opacity={0.18} />
        <Upright x={22} y={0} angle={angle}>
          <text className="pole minus" textAnchor="middle" dominantBaseline="central">−</text>
        </Upright>
        <Upright x={L - 34} y={0} angle={angle}>
          <text className="pole plus" textAnchor="middle" dominantBaseline="central">+</text>
        </Upright>
        <rect className="hit" x={0} y={-24} width={L} height={48} />
      </g>
    );
  }

  if (part.kind === 'switch') {
    const lever = part.closed ? 0 : -32;
    return (
      <g className={cls} data-part={part.id} transform={t}>
        {selected && <rect className="sel-ring" x={-4} y={-30} width={L + 8} height={50} rx={14} />}
        {highlighted && <rect className="hl-ring" x={-4} y={-30} width={L + 8} height={50} rx={14} />}
        <line className="lead" x1={0} y1={0} x2={22} y2={0} />
        <line className="lead" x1={L - 22} y1={0} x2={L} y2={0} />
        <rect x={10} y={2} width={L - 20} height={14} rx={5} fill="#7fa8e0" />
        <circle cx={22} cy={0} r={6} fill="#9aa3b2" />
        <circle cx={L - 22} cy={0} r={6} fill="#9aa3b2" />
        <g transform={`rotate(${lever} 22 0)`}>
          <line x1={22} y1={0} x2={L - 18} y2={0} stroke="#8a919e" strokeWidth={6} strokeLinecap="round" />
          <circle cx={L - 18} cy={0} r={7} fill="#e2554f" />
        </g>
        <Upright x={L / 2} y={30} angle={angle}>
          <text className="tag" textAnchor="middle" dominantBaseline="central">{part.closed ? '닫힘' : '열림'}</text>
        </Upright>
        <rect className="hit" x={0} y={-34} width={L} height={58} />
      </g>
    );
  }

  // 전구 + 전구 끼우개
  const lit = !part.removed && brightness > 0;
  const n = part.removed ? 0 : stars(brightness);
  const glowR = 30 + 28 * Math.min(brightness, 2.5);
  const glowO = Math.min(1, 0.35 + brightness * 0.5);
  return (
    <g className={cls} data-part={part.id} transform={t}>
      {selected && <rect className="sel-ring" x={-4} y={-64} width={L + 8} height={84} rx={16} />}
      {highlighted && <rect className="hl-ring" x={-4} y={-64} width={L + 8} height={84} rx={16} />}
      {lit && n > 0 && <circle cx={L / 2} cy={-36} r={glowR} fill="url(#glow)" opacity={glowO} pointerEvents="none" />}
      <line className="lead" x1={0} y1={0} x2={16} y2={0} />
      <line className="lead" x1={L - 16} y1={0} x2={L} y2={0} />
      <rect x={14} y={-9} width={L - 28} height={18} rx={5} fill="#c8915a" />
      <rect x={18} y={-4} width={12} height={8} rx={2} fill="#d9dde3" />
      <rect x={L - 30} y={-4} width={12} height={8} rx={2} fill="#d9dde3" />
      <rect x={L / 2 - 11} y={-20} width={22} height={13} rx={3} fill="#a7adb7" />
      <g opacity={part.removed ? 0.35 : 1} transform={part.removed ? 'translate(0 -18)' : undefined}>
        <circle
          cx={L / 2}
          cy={-38}
          r={20}
          fill={n > 0 ? '#fff6a6' : '#eaf3ff'}
          stroke={n > 0 ? '#f2b705' : '#9fb3cc'}
          strokeWidth={2}
          strokeDasharray={part.removed ? '4 3' : undefined}
        />
        <path
          d={`M${L / 2 - 6} -22 L${L / 2 - 6} -38 q3 -6 6 0 q3 6 6 0 L${L / 2 + 6} -22`}
          fill="none"
          stroke={n > 0 ? '#e67e00' : '#8796ab'}
          strokeWidth={1.8}
        />
      </g>
      <Upright x={L / 2} y={24} angle={angle}>
        {part.removed ? (
          <text className="tag warn" textAnchor="middle" dominantBaseline="central">빠짐</text>
        ) : (
          <text className="stars" textAnchor="middle" dominantBaseline="central" aria-label={`밝기 별 ${n}개`}>
            {[0, 1, 2, 3, 4].map((i) => (
              <tspan key={i} className={i < n ? 'on' : 'off'}>★</tspan>
            ))}
          </text>
        )}
      </Upright>
      <rect className="hit" x={0} y={-62} width={L} height={78} />
    </g>
  );
}

export function PartIcon({ kind }: { kind: Part['kind'] }) {
  const a = { id: 'a', x: 6, y: 52 };
  const L = { battery: 120, bulb: 100, switch: 100, wire: 100 }[kind];
  const b = { id: 'b', x: 6 + L, y: 52 };
  return (
    <svg viewBox={`0 0 ${L + 12} 80`} aria-hidden="true">
      {kind === 'wire' ? (
        <g className="part part-wire">
          <path d={`M6 60 C 40 20, 70 80, ${L + 6} 30`} className="wire-outline" fill="none" />
          <path d={`M6 60 C 40 20, 70 80, ${L + 6} 30`} className="wire-core" fill="none" />
        </g>
      ) : (
        <PartView
          part={{ id: 'icon', kind, a: 'a', b: 'b', closed: kind === 'switch' ? false : undefined }}
          a={a}
          b={b}
          brightness={kind === 'bulb' ? 1 : 0}
          hot={false}
          selected={false}
          highlighted={false}
        />
      )}
    </svg>
  );
}
