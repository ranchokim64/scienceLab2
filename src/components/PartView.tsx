import { stars } from '../engine/solver';
import { MATERIALS, PART_LENGTH, Part, Vertex } from '../engine/types';

export type ViewMode = 'real' | 'symbol';

interface Props {
  part: Part;
  a: Vertex;
  b: Vertex;
  brightness: number;
  current?: number;
  magnet?: { clips: number; pole: 1 | -1 | 0 };
  hot: boolean;
  selected: boolean;
  highlighted: boolean;
  mode?: ViewMode;
  showNumbers?: boolean;
}

const deg = (r: number) => (r * 180) / Math.PI;

/** 부품 아래쪽(부품 기준)에 붙는 글자가 세로로 놓인 부품을 가리지 않도록 정렬을 고른다. */
const sideAnchor = (angle: number): 'start' | 'middle' | 'end' => {
  const px = -Math.sin(angle);
  if (Math.abs(px) < 0.6) return 'middle';
  return px > 0 ? 'start' : 'end';
};

/** 회전한 부품 안에서도 글자가 똑바로 보이도록 되돌려 돌린다. */
function Upright({ x, y, angle, children }: { x: number; y: number; angle: number; children: React.ReactNode }) {
  return <g transform={`translate(${x} ${y}) rotate(${-deg(angle)})`}>{children}</g>;
}

function StarRow({ n, anchor = 'middle' }: { n: number; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text className="stars" textAnchor={anchor} dominantBaseline="central" aria-label={`밝기 별 ${n}개`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <tspan key={i} className={i < n ? 'on' : 'off'}>★</tspan>
      ))}
    </text>
  );
}

function Num({ children, anchor = 'middle' }: { children: React.ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text className="num" textAnchor={anchor} dominantBaseline="central">
      {children}
    </text>
  );
}

const amps = (I = 0) => `${Math.abs(I) < 0.005 ? '0' : Math.abs(I).toFixed(2)} A`;

/** 감싸는 테두리(선택·힌트 표시) */
function Rings({ L, y, h, selected, highlighted }: { L: number; y: number; h: number; selected: boolean; highlighted: boolean }) {
  return (
    <>
      {selected && <rect className="sel-ring" x={-4} y={y} width={L + 8} height={h} rx={14} />}
      {highlighted && <rect className="hl-ring" x={-4} y={y} width={L + 8} height={h} rx={14} />}
    </>
  );
}

export function PartView(props: Props) {
  const { part, a, b, brightness, current, magnet, hot, selected, highlighted, mode = 'real', showNumbers } = props;
  const cls = ['part', `part-${part.kind}`, mode === 'symbol' && 'symbol', selected && 'sel', highlighted && 'hl', hot && 'hot']
    .filter(Boolean)
    .join(' ');

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
  const ringProps = { L, selected, highlighted };
  const anc = sideAnchor(angle);
  const sym = mode === 'symbol';

  /* ---------------- 전지 ---------------- */
  if (part.kind === 'battery') {
    return (
      <g className={cls} data-part={part.id} transform={t}>
        <Rings {...ringProps} y={-26} h={52} />
        {sym ? (
          <>
            <line className="sym" x1={0} y1={0} x2={L / 2 - 6} y2={0} />
            <line className="sym" x1={L / 2 + 6} y1={0} x2={L} y2={0} />
            <line className="sym thick" x1={L / 2 - 6} y1={-9} x2={L / 2 - 6} y2={9} />
            <line className="sym" x1={L / 2 + 6} y1={-20} x2={L / 2 + 6} y2={20} />
            <Upright x={L / 2 - 20} y={-16} angle={angle}>
              <text className="sym-label" textAnchor="middle" dominantBaseline="central">−</text>
            </Upright>
            <Upright x={L / 2 + 20} y={-16} angle={angle}>
              <text className="sym-label" textAnchor="middle" dominantBaseline="central">+</text>
            </Upright>
          </>
        ) : (
          <>
            <line className="lead" x1={0} y1={0} x2={10} y2={0} />
            <line className="lead" x1={L - 10} y1={0} x2={L} y2={0} />
            <rect x={8} y={-18} width={L - 26} height={36} rx={6} fill="#2f3542" />
            <rect x={8 + (L - 26) * 0.62} y={-18} width={(L - 26) * 0.38} height={36} rx={6} fill="#f5b52e" />
            <rect x={8 + (L - 26) * 0.62} y={-18} width={6} height={36} fill="#f5b52e" />
            <rect x={L - 18} y={-8} width={8} height={16} rx={2} fill="#c9ccd3" />
            <rect x={10} y={-14} width={L - 30} height={6} rx={3} fill="#ffffff" opacity={0.18} />
            <Upright x={22} y={0} angle={angle}>
              <rect x={-7} y={-2} width={14} height={4} rx={1} fill="#fff" />
            </Upright>
            <Upright x={L - 34} y={0} angle={angle}>
              <text className="pole plus" textAnchor="middle" dominantBaseline="central">+</text>
            </Upright>
          </>
        )}
        {showNumbers && (
          <Upright x={L / 2} y={32} angle={angle}>
            <Num anchor={anc}>1.5 V · {amps(current)}</Num>
          </Upright>
        )}
        <rect className="hit" x={0} y={-24} width={L} height={48} />
      </g>
    );
  }

  /* ---------------- 스위치 ---------------- */
  if (part.kind === 'switch') {
    const lever = part.closed ? 0 : -32;
    return (
      <g className={cls} data-part={part.id} transform={t}>
        <Rings {...ringProps} y={-30} h={50} />
        {sym ? (
          <>
            <line className="sym" x1={0} y1={0} x2={28} y2={0} />
            <line className="sym" x1={L - 28} y1={0} x2={L} y2={0} />
            <circle className="sym-dot" cx={28} cy={0} r={4} />
            <circle className="sym-dot" cx={L - 28} cy={0} r={4} />
            <line className="sym" x1={28} y1={0} x2={L - 26} y2={0} transform={`rotate(${part.closed ? 0 : -28} 28 0)`} />
          </>
        ) : (
          <>
            <line className="lead" x1={0} y1={0} x2={22} y2={0} />
            <line className="lead" x1={L - 22} y1={0} x2={L} y2={0} />
            <rect x={10} y={2} width={L - 20} height={14} rx={5} fill="#7fa8e0" />
            <circle cx={22} cy={0} r={6} fill="#9aa3b2" />
            <circle cx={L - 22} cy={0} r={6} fill="#9aa3b2" />
            <g transform={`rotate(${lever} 22 0)`}>
              <line x1={22} y1={0} x2={L - 18} y2={0} stroke="#8a919e" strokeWidth={6} strokeLinecap="round" />
              <circle cx={L - 18} cy={0} r={7} fill="#e2554f" />
            </g>
          </>
        )}
        <Upright x={L / 2} y={30} angle={angle}>
          <text className="tag" textAnchor={anc} dominantBaseline="central">{part.closed ? '닫힘' : '열림'}</text>
        </Upright>
        <rect className="hit" x={0} y={-34} width={L} height={58} />
      </g>
    );
  }

  /* ---------------- 검사할 물체 ---------------- */
  if (part.kind === 'object') {
    const m = part.material ?? 'clip';
    return (
      <g className={cls} data-part={part.id} transform={t}>
        <Rings {...ringProps} y={-26} h={52} />
        {sym ? (
          <>
            <line className="sym" x1={0} y1={0} x2={30} y2={0} />
            <line className="sym" x1={L - 30} y1={0} x2={L} y2={0} />
            <rect className="sym-box" x={30} y={-12} width={L - 60} height={24} />
          </>
        ) : (
          <>
            <line className="lead" x1={0} y1={0} x2={30} y2={0} />
            <line className="lead" x1={L - 30} y1={0} x2={L} y2={0} />
            <MaterialArt m={m} L={L} />
            {/* 집게 */}
            <rect x={22} y={-7} width={12} height={14} rx={3} fill="#cf3b3b" />
            <rect x={L - 34} y={-7} width={12} height={14} rx={3} fill="#2f3542" />
          </>
        )}
        <Upright x={L / 2} y={30} angle={angle}>
          <text className="tag" textAnchor={anc} dominantBaseline="central">{MATERIALS[m].name}</text>
        </Upright>
        <rect className="hit" x={0} y={-26} width={L} height={52} />
      </g>
    );
  }

  /* ---------------- 전자석(에나멜선을 감은 철못) ---------------- */
  if (part.kind === 'coil') {
    const turns = part.turns ?? 1;
    const loops = turns === 2 ? 14 : 7;
    const clips = magnet?.clips ?? 0;
    const pole = magnet?.pole ?? 0;
    const y = -30;
    const x0 = 24;
    const x1 = L - 24;
    // 나침반 바늘: 자석이 아니면 북쪽(화면 위), 자석이면 S극 쪽(바늘의 N이 끌려감)
    const needle = pole === 0 ? -deg(angle) : pole === 1 ? -90 : 90;
    return (
      <g className={cls} data-part={part.id} transform={t}>
        <Rings {...ringProps} y={-108} h={130} />
        {sym ? (
          <>
            <line className="sym" x1={0} y1={0} x2={x0} y2={0} />
            <line className="sym" x1={x1} y1={0} x2={L} y2={0} />
            <path
              className="sym"
              fill="none"
              d={`M${x0} 0 ${Array.from({ length: 5 }, () => `a ${(x1 - x0) / 10} ${(x1 - x0) / 10} 0 0 1 ${(x1 - x0) / 5} 0`).join(' ')}`}
              transform={`translate(0 0)`}
            />
            <line className="sym" x1={x0} y1={-16} x2={x1} y2={-16} />
          </>
        ) : (
          <>
            <path className="lead copper" d={`M0 0 L${x0 - 6} 0 L${x0} ${y}`} fill="none" />
            <path className="lead copper" d={`M${L} 0 L${x1 + 6} 0 L${x1} ${y}`} fill="none" />
            {/* 철못 */}
            <rect x={x0 - 14} y={y - 12} width={6} height={24} rx={2} fill="#7b8494" />
            <path d={`M${x0 - 10} ${y - 6} L${x1 + 4} ${y - 6} L${x1 + 18} ${y} L${x1 + 4} ${y + 6} L${x0 - 10} ${y + 6} Z`} fill="#a7afbd" />
            {/* 코일 */}
            {Array.from({ length: loops }, (_, i) => {
              const cx = x0 + 4 + ((x1 - x0 - 8) * (i + 0.5)) / loops;
              return <ellipse key={i} cx={cx} cy={y} rx={(x1 - x0) / loops / 2 + 0.5} ry={10} fill="none" stroke="#c46a1b" strokeWidth={3} />;
            })}
            {/* 끌려온 클립 */}
            {Array.from({ length: clips }, (_, i) => (
              <rect
                key={i}
                x={x1 + 8 + (i % 3) * 7}
                y={y + 8 + Math.floor(i / 3) * 9}
                width={14}
                height={6}
                rx={3}
                fill="none"
                stroke="#5d6b82"
                strokeWidth={2}
                transform={`rotate(${(i % 2 ? 25 : -20)} ${x1 + 15 + (i % 3) * 7} ${y + 11 + Math.floor(i / 3) * 9})`}
              />
            ))}
            {pole !== 0 && (
              <>
                <Upright x={x0 - 20} y={y} angle={angle}>
                  <text className={`magpole ${pole === 1 ? 's' : 'n'}`} textAnchor="middle" dominantBaseline="central">{pole === 1 ? 'S' : 'N'}</text>
                </Upright>
                <Upright x={x1 + 30} y={y - 14} angle={angle}>
                  <text className={`magpole ${pole === 1 ? 'n' : 's'}`} textAnchor="middle" dominantBaseline="central">{pole === 1 ? 'N' : 'S'}</text>
                </Upright>
              </>
            )}
          </>
        )}
        {/* 나침반 */}
        <g transform={`translate(${L / 2} -82)`}>
          <circle r={18} fill="#fff" stroke="#94a3b8" strokeWidth={2} />
          <g className="needle" transform={`rotate(${needle})`}>
            <path d="M0 -14 L5 0 L-5 0 Z" fill="#e5484d" />
            <path d="M0 14 L5 0 L-5 0 Z" fill="#64748b" />
          </g>
        </g>
        <Upright x={L / 2} y={24} angle={angle}>
          {showNumbers ? <Num anchor={anc}>{amps(current)} · 클립 {clips}개</Num> : <text className="tag" textAnchor={anc} dominantBaseline="central">클립 {clips}개</text>}
        </Upright>
        <rect className="hit" x={0} y={-104} width={L} height={124} />
      </g>
    );
  }

  /* ---------------- 전구 + 전구 끼우개 ---------------- */
  const n = part.removed ? 0 : stars(brightness);
  const glowR = 30 + 28 * Math.min(brightness, 2.5);
  const glowO = Math.min(1, 0.35 + brightness * 0.5);
  const cy = sym ? 0 : -38;
  return (
    <g className={cls} data-part={part.id} transform={t}>
      <Rings {...ringProps} y={-64} h={84} />
      {n > 0 && <circle cx={L / 2} cy={cy} r={glowR} fill="url(#glow)" opacity={glowO} pointerEvents="none" />}
      {sym ? (
        <g opacity={part.removed ? 0.35 : 1}>
          <line className="sym" x1={0} y1={0} x2={L / 2 - 18} y2={0} />
          <line className="sym" x1={L / 2 + 18} y1={0} x2={L} y2={0} />
          <circle className="sym-box" cx={L / 2} cy={0} r={18} fill={n > 0 ? '#fff6a6' : '#fff'} strokeDasharray={part.removed ? '4 3' : undefined} />
          <path className="sym" d={`M${L / 2 - 12.7} -12.7 L${L / 2 + 12.7} 12.7 M${L / 2 + 12.7} -12.7 L${L / 2 - 12.7} 12.7`} />
        </g>
      ) : (
        <>
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
        </>
      )}
      <Upright x={L / 2} y={sym ? 30 : 24} angle={angle}>
        {part.removed ? <text className="tag warn" textAnchor={anc} dominantBaseline="central">빠짐</text> : <StarRow n={n} anchor={anc} />}
      </Upright>
      {showNumbers && !part.removed && (
        <Upright x={L / 2} y={sym ? 48 : 42} angle={angle}>
          <Num anchor={anc}>{amps(current)}</Num>
        </Upright>
      )}
      <rect className="hit" x={0} y={-62} width={L} height={78} />
    </g>
  );
}

function MaterialArt({ m, L }: { m: string; L: number }) {
  const cx = L / 2;
  switch (m) {
    case 'clip':
      return (
        <path
          d={`M${cx - 26} 4 L${cx + 20} 4 A6 6 0 0 0 ${cx + 20} -8 L${cx - 22} -8 A4 4 0 0 0 ${cx - 22} 0 L${cx + 14} 0`}
          fill="none"
          stroke="#8b96a8"
          strokeWidth={3}
          strokeLinecap="round"
        />
      );
    case 'foil':
      return <path d={`M${cx - 26} -10 l10 3 l8 -4 l10 4 l9 -3 l10 3 l-2 16 l-9 -2 l-10 3 l-9 -3 l-10 3 l-8 -2 Z`} fill="#d7dde6" stroke="#9aa6b8" strokeWidth={1.5} />;
    case 'coin':
      return (
        <g>
          <circle cx={cx} cy={0} r={14} fill="#d08a4b" stroke="#a7642c" strokeWidth={2} />
          <text x={cx} y={1} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800} fill="#7a4518">
            10
          </text>
        </g>
      );
    case 'eraser':
      return (
        <g>
          <rect x={cx - 24} y={-10} width={48} height={20} rx={3} fill="#f7f7f2" stroke="#c9ccd3" />
          <rect x={cx - 8} y={-10} width={26} height={20} fill="#4f7cff" />
        </g>
      );
    case 'ruler':
      return (
        <g>
          <rect x={cx - 30} y={-9} width={60} height={18} rx={2} fill="#9fd3ff" fillOpacity={0.7} stroke="#5aa9e6" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={i} x1={cx - 26 + i * 6.5} y1={-9} x2={cx - 26 + i * 6.5} y2={i % 2 ? -4 : -1} stroke="#3b7fb8" strokeWidth={1} />
          ))}
        </g>
      );
    default:
      return <rect x={cx - 30} y={-4} width={60} height={8} rx={3} fill="#e3c08a" stroke="#b8935a" />;
  }
}

export function PartIcon({ kind }: { kind: Part['kind'] }) {
  const L = kind === 'wire' ? 100 : PART_LENGTH[kind];
  const top = kind === 'coil' ? 112 : 66;
  const a = { id: 'a', x: 6, y: top };
  const b = { id: 'b', x: 6 + L, y: top };
  return (
    <svg viewBox={`0 0 ${L + 12} ${top + 28}`} aria-hidden="true">
      {kind === 'wire' ? (
        <g className="part part-wire">
          <path d={`M6 ${top + 8} C 40 ${top - 32}, 70 ${top + 28}, ${L + 6} ${top - 22}`} className="wire-outline" fill="none" />
          <path d={`M6 ${top + 8} C 40 ${top - 32}, 70 ${top + 28}, ${L + 6} ${top - 22}`} className="wire-core" fill="none" />
        </g>
      ) : (
        <PartView
          part={{ id: 'icon', kind, a: 'a', b: 'b', closed: kind === 'switch' ? false : undefined, material: 'clip', turns: 1 }}
          a={a}
          b={b}
          brightness={kind === 'bulb' ? 1 : 0}
          magnet={kind === 'coil' ? { clips: 3, pole: 1 } : undefined}
          hot={false}
          selected={false}
          highlighted={false}
        />
      )}
    </svg>
  );
}
