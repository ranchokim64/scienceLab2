import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Arrangement, arrangement, diagnose, litBulbs } from './engine/analysis';
import { Solution, solve, stars } from './engine/solver';
import { Circuit, emptyCircuit } from './engine/types';
import { MISSIONS, Observed } from './missions';
import { BulbSummary, HintBox, MissionPanel, ReferenceCard, Stars } from './components/Panels';
import { Highlight, Workspace } from './components/Workspace';
import { CircuitStore, loadJSON, saveJSON, useCircuitStores } from './store';

type Mode = 'mission' | 'free' | 'compare';

function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => loadJSON(key, initial));
  useEffect(() => saveJSON(key, v), [key, v]);
  return [v, setV] as const;
}

const initialFor = (key: string): Circuit => {
  const m = MISSIONS.find((mm) => `mission-${mm.id}` === key);
  return m?.preset ? m.preset() : emptyCircuit();
};

function useSolved(store: CircuitStore) {
  const sol = useMemo(() => solve(store.circuit), [store.circuit]);
  const arr = useMemo(() => arrangement(store.circuit, sol), [store.circuit, sol]);
  const hint = useMemo(() => diagnose(store.circuit, sol), [store.circuit, sol]);
  return { sol, arr, hint };
}

export default function App() {
  const [mode, setMode] = usePersisted<Mode>('mode', 'mission');
  const [missionIndex, setMissionIndex] = usePersisted('mission', 0);
  const [showFlow, setShowFlow] = usePersisted('flow', true);
  const [predictions, setPredictions] = usePersisted<Record<string, number>>('predictions', {});
  const [completed, setCompleted] = usePersisted<Record<string, boolean>>('completed', {});
  const [observed, setObserved] = useState<Record<string, Observed>>({});
  const [hintLevel, setHintLevel] = useState(0);
  const [activeSide, setActiveSide] = useState<'a' | 'b'>('a');

  const stores = useCircuitStores(initialFor);
  const mission = MISSIONS[Math.min(missionIndex, MISSIONS.length - 1)];
  const mainKey = mode === 'mission' ? `mission-${mission.id}` : mode === 'free' ? 'free' : 'compare-a';
  const main = stores(mainKey);
  const side = stores('compare-b');
  const active = mode === 'compare' && activeSide === 'b' ? side : main;

  const mainS = useSolved(main);
  const sideS = useSolved(side);
  const activeS = active === side ? sideS : mainS;

  useEffect(() => setHintLevel(0), [mode, missionIndex, activeSide]);

  /* ---------- 미션 달성 확인 ---------- */
  const obs = observed[mission.id] ?? {};
  const reached =
    mode === 'mission' &&
    mission.check({ circuit: main.circuit, sol: mainS.sol, arrangement: mainS.arr, observed: obs });
  // 예상하기가 있는 미션은 예상을 먼저 골라야 결과(성공)를 보여 준다.
  const waitingPrediction = reached && !!mission.prediction && predictions[mission.id] === undefined;
  const done = reached && !waitingPrediction;
  const wasDone = useRef(false);
  useEffect(() => {
    if (done && !wasDone.current) setCompleted((c) => ({ ...c, [mission.id]: true }));
    wasDone.current = done;
  }, [done, mission.id, setCompleted]);

  const onBulbRemoved = useCallback(
    (before: Arrangement) => {
      setObserved((o) => {
        const cur = o[mission.id] ?? {};
        if (before === 'series') return { ...o, [mission.id]: { ...cur, removedInSeries: true } };
        if (before === 'parallel') return { ...o, [mission.id]: { ...cur, removedInParallel: true } };
        return o;
      });
    },
    [mission.id],
  );

  /* ---------- 키보드: 되돌리기 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        active.undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        active.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const resetActive = () => {
    if (!active.circuit.parts.length) return;
    if (!window.confirm('회로를 모두 지우고 처음부터 할까요?')) return;
    const key = active === side ? 'compare-b' : mainKey;
    active.reset(initialFor(key));
    if (mode === 'mission') setObserved((o) => ({ ...o, [mission.id]: {} }));
  };

  const highlight = (s: { hint: ReturnType<typeof diagnose> }): Highlight | null =>
    hintLevel >= 2 ? { parts: s.hint.parts, vertices: s.hint.vertices } : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">💡</span>
          <span className="brand-name">반짝 회로 실험실</span>
        </div>
        <nav className="tabs" role="tablist">
          {(
            [
              ['mission', '🎯 미션'],
              ['free', '🧪 자유 실험'],
              ['compare', '⚖️ 비교하기'],
            ] as const
          ).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="actions">
          <button onClick={active.undo} disabled={!active.canUndo} title="되돌리기 (Ctrl+Z)">
            ↶<span className="lbl"> 되돌리기</span>
          </button>
          <button onClick={active.redo} disabled={!active.canRedo} title="다시 하기 (Ctrl+Y)">
            ↷<span className="lbl"> 다시 하기</span>
          </button>
          <button className={showFlow ? 'on' : ''} onClick={() => setShowFlow(!showFlow)} aria-pressed={showFlow} title="전기 흐름 보기">
            ⚡<span className="lbl"> 전기 흐름</span>
          </button>
          <button onClick={resetActive} title="처음부터">
            🧹<span className="lbl"> 처음부터</span>
          </button>
        </div>
      </header>

      <main className={`main mode-${mode}`}>
        <section className="stage">
          <Workspace
            key={mainKey}
            store={main}
            sol={mainS.sol}
            limits={mode === 'mission' ? mission.parts : undefined}
            showFlow={showFlow}
            highlight={active === main ? highlight(mainS) : null}
            onBulbRemoved={mode === 'mission' ? onBulbRemoved : undefined}
            onActivate={() => setActiveSide('a')}
            active={active === main}
            label={mode === 'compare' ? '회로 가' : undefined}
          />
          {mode === 'compare' && (
            <Workspace
              key="compare-b"
              store={side}
              sol={sideS.sol}
              showFlow={showFlow}
              highlight={active === side ? highlight(sideS) : null}
              onActivate={() => setActiveSide('b')}
              active={active === side}
              label="회로 나"
            />
          )}
        </section>

        <aside className="panel">
          {mode === 'mission' && (
            <MissionPanel
              missions={MISSIONS}
              index={missionIndex}
              setIndex={setMissionIndex}
              completed={completed}
              prediction={predictions[mission.id]}
              setPrediction={(n) => setPredictions((p) => ({ ...p, [mission.id]: n as number }))}
              done={done}
              waitingPrediction={waitingPrediction}
              observed={obs}
              circuit={main.circuit}
              sol={mainS.sol}
              arr={mainS.arr}
            />
          )}
          {mode === 'free' && (
            <div className="card">
              <div className="card-title">🧪 자유 실험</div>
              <div>부품을 마음껏 꺼내 여러 가지 회로를 만들어 보세요. 전지를 두 개 쓰면 어떻게 될까요?</div>
            </div>
          )}
          {mode === 'compare' && <CompareSummary a={main.circuit} b={side.circuit} sa={mainS.sol} sb={sideS.sol} />}

          {!(mode === 'mission' && done) && <HintBox hint={activeS.hint} level={hintLevel} setLevel={setHintLevel} />}
          {mode !== 'compare' && <BulbSummary circuit={active.circuit} sol={activeS.sol} arr={activeS.arr} />}
          <ReferenceCard />
        </aside>
      </main>
    </div>
  );
}

function CompareSummary({ a, b, sa, sb }: { a: Circuit; b: Circuit; sa: Solution; sb: Solution }) {
  const best = (c: Circuit, s: Solution) => Math.max(0, ...litBulbs(c, s).map((p) => s.brightness[p.id]));
  const ba = best(a, sa);
  const bb = best(b, sb);
  const na = stars(ba);
  const nb = stars(bb);
  let verdict = '두 회로를 만들어 전구의 밝기를 비교해 보세요.';
  if (na || nb) verdict = na === nb ? '두 회로의 전구 밝기가 비슷해요.' : `회로 ${na > nb ? '가' : '나'}의 전구가 더 밝아요.`;
  return (
    <div className="card">
      <div className="card-title">⚖️ 두 회로 비교하기</div>
      <div className="muted">회로 가와 회로 나에 서로 다른 회로를 만들어 보세요. 예: 직렬과 병렬</div>
      <table className="cmp">
        <tbody>
          <tr>
            <th>회로 가</th>
            <td>{ARR(a, sa)}</td>
            <td>
              <Stars n={na} />
            </td>
          </tr>
          <tr>
            <th>회로 나</th>
            <td>{ARR(b, sb)}</td>
            <td>
              <Stars n={nb} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="verdict">{verdict}</div>
    </div>
  );
}

const ARR = (c: Circuit, s: Solution) =>
  ({ none: '-', single: '전구 1개', series: '직렬', parallel: '병렬', mixed: '섞임' })[arrangement(c, s)];
