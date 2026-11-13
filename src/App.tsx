import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ARRANGEMENT_NAME, Arrangement, arrangement, diagnose, litBulbs, testedObjects } from './engine/analysis';
import { Solution, solve, stars } from './engine/solver';
import { Circuit, MATERIALS, emptyCircuit } from './engine/types';
import { MISSIONS, Mission, Observed } from './missions';
import { BulbSummary, HintBox, MissionPanel, ReferenceCard, Stars } from './components/Panels';
import { Highlight, Workspace } from './components/Workspace';
import { NoteEntry, NotebookModal, PrintSheet } from './components/Notebook';
import { TeacherModal } from './components/Teacher';
import { ViewMode } from './components/PartView';
import { CircuitStore, clearAll, loadJSON, saveJSON, useCircuitStores } from './store';
import { buildShareUrl, decodeCircuit, parseShareHash } from './share';

type Mode = 'mission' | 'free' | 'compare';

function usePersisted<T>(key: string, initial: T, onFail?: () => void) {
  const [v, setV] = useState<T>(() => loadJSON(key, initial));
  useEffect(() => {
    if (!saveJSON(key, v)) onFail?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, v]);
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

/** 주소의 # 뒤(선생님이 보낸 링크)를 처음 한 번 읽는다. */
const shared = parseShareHash(typeof location !== 'undefined' ? location.hash : '');
const sharedMissionIndex = MISSIONS.findIndex((m) => m.id === shared.m);
const locked = shared.lock && (shared.m === 'free' || sharedMissionIndex >= 0);

export default function App() {
  const [toast, setToast] = useState<string | null>(null);
  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  const [mode, setMode] = usePersisted<Mode>('mode', 'mission');
  const [missionIndex, setMissionIndex] = usePersisted('mission', 0);
  const [showFlow, setShowFlow] = usePersisted('flow', true);
  const [localNumbers, setLocalNumbers] = usePersisted('numbers', false);
  const [viewMode, setViewMode] = usePersisted<ViewMode>('view', 'real');
  const [predictions, setPredictions] = usePersisted<Record<string, number>>('predictions', {});
  const [completed, setCompleted] = usePersisted<Record<string, boolean>>('completed', {});
  const [notebook, setNotebook] = usePersisted<NoteEntry[]>('notebook', [], () =>
    say('저장 공간이 부족해요. 기록장에서 오래된 기록을 지워 주세요.'),
  );
  const [studentName, setStudentName] = usePersisted('name', '');
  const [observed, setObserved] = useState<Record<string, Observed>>({});
  const [hintLevel, setHintLevel] = useState(0);
  const [activeSide, setActiveSide] = useState<'a' | 'b'>('a');
  const [dialog, setDialog] = useState<'notebook' | 'teacher' | null>(null);

  const stores = useCircuitStores(initialFor);
  const mission: Mission = MISSIONS[Math.min(missionIndex, MISSIONS.length - 1)];
  const mainKey = mode === 'mission' ? `mission-${mission.id}` : mode === 'free' ? 'free' : 'compare-a';
  const main = stores(mainKey);
  const side = stores('compare-b');
  const active = mode === 'compare' && activeSide === 'b' ? side : main;
  const showNumbers = localNumbers || shared.num;

  const mainS = useSolved(main);
  const sideS = useSolved(side);
  const activeS = active === side ? sideS : mainS;

  /* ---------- 선생님 링크 적용(처음 한 번) ---------- */
  const appliedShare = useRef(false);
  useEffect(() => {
    if (appliedShare.current) return;
    appliedShare.current = true;
    if (!shared.m) return;
    if (shared.m === 'free') setMode('free');
    else if (sharedMissionIndex >= 0) {
      setMode('mission');
      setMissionIndex(sharedMissionIndex);
    }
    if (shared.sym) setViewMode('symbol');
    const c = shared.c ? decodeCircuit(shared.c) : null;
    if (c) {
      const key = shared.m === 'free' ? 'free' : `mission-${shared.m}`;
      stores(key).reset(c);
    }
    // 다시 불러와도 회로를 덮어쓰지 않도록 주소에서 회로만 뺀다.
    if (shared.c) history.replaceState(null, '', buildShareUrl(location.pathname, { ...shared, c: undefined }));
  }, [stores, setMode, setMissionIndex, setViewMode]);

  useEffect(() => {
    if (locked && shared.m === 'free' && mode !== 'free') setMode('free');
    if (locked && sharedMissionIndex >= 0 && (mode !== 'mission' || missionIndex !== sharedMissionIndex)) {
      setMode('mission');
      setMissionIndex(sharedMissionIndex);
    }
  }, [mode, missionIndex, setMode, setMissionIndex]);

  useEffect(() => setHintLevel(0), [mode, missionIndex, activeSide]);

  /* ---------- 관찰 기록(물체 검사, 전자석) ---------- */
  const obs = observed[mission.id] ?? {};
  const patchObserved = useCallback(
    (id: string, fn: (o: Observed) => Observed) => setObserved((all) => ({ ...all, [id]: fn(all[id] ?? {}) })),
    [],
  );

  useEffect(() => {
    if (mode !== 'mission' || mission.id !== 'conductor') return;
    const results = testedObjects(main.circuit);
    if (!results.length) return;
    patchObserved('conductor', (o) => {
      const tested = { ...o.tested };
      let changed = false;
      for (const r of results) {
        if (tested[r.material] === undefined) {
          tested[r.material] = r.conducts;
          changed = true;
        }
      }
      return changed ? { ...o, tested } : o;
    });
  }, [mode, mission.id, main.circuit, patchObserved]);

  const lastMagnet = useRef<{ key: string; clips: number; pole: number }>({ key: '', clips: 0, pole: 0 });
  useEffect(() => {
    if (mode !== 'mission' || !mission.id.startsWith('magnet')) return;
    const coils = main.circuit.parts.filter((p) => p.kind === 'coil');
    const ms = coils.map((p) => mainS.sol.magnet[p.id]).filter(Boolean);
    const clips = Math.max(0, ...ms.map((m) => m.clips));
    const pole = ms.find((m) => m.clips > 0)?.pole ?? 0;
    const prev = lastMagnet.current.key === mainKey ? lastMagnet.current : { key: mainKey, clips: 0, pole: 0 };
    const switchOpen = main.circuit.parts.some((p) => p.kind === 'switch' && !p.closed);
    patchObserved(mission.id, (o) => {
      const n = { ...o };
      if (clips > 0) n.magnetOn = true;
      n.maxClips = Math.max(o.maxClips ?? 0, clips);
      if (prev.clips > 0 && clips === 0 && switchOpen) n.magnetOffBySwitch = true;
      if (prev.pole !== 0 && pole !== 0 && prev.pole !== pole) n.poleFlipped = true;
      return JSON.stringify(n) === JSON.stringify(o) ? o : n;
    });
    lastMagnet.current = { key: mainKey, clips, pole };
  }, [mode, mission.id, mainKey, main.circuit, mainS.sol, patchObserved]);

  const onBulbRemoved = useCallback(
    (before: Arrangement) => {
      patchObserved(mission.id, (cur) => {
        if (before === 'series') return { ...cur, removedInSeries: true };
        if (before === 'parallel') return { ...cur, removedInParallel: true };
        return cur;
      });
    },
    [mission.id, patchObserved],
  );

  /* ---------- 미션 달성 확인 ---------- */
  const reached =
    mode === 'mission' && mission.check({ circuit: main.circuit, sol: mainS.sol, arrangement: mainS.arr, observed: obs });
  // 예상하기가 있는 미션은 예상을 먼저 골라야 결과(성공)를 보여 준다.
  const waitingPrediction = reached && !!mission.prediction && predictions[mission.id] === undefined;
  const done = reached && !waitingPrediction;
  const wasDone = useRef(false);
  useEffect(() => {
    if (done && !wasDone.current) setCompleted((c) => ({ ...c, [mission.id]: true }));
    wasDone.current = done;
  }, [done, mission.id, setCompleted]);

  /* ---------- 키보드: 되돌리기 ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || dialog) return;
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
  }, [active, dialog]);

  const resetActive = () => {
    if (!active.circuit.parts.length) return;
    if (!window.confirm('회로를 모두 지우고 처음부터 할까요?')) return;
    const key = active === side ? 'compare-b' : mainKey;
    active.reset(initialFor(key));
    if (mode === 'mission') setObserved((o) => ({ ...o, [mission.id]: {} }));
  };

  /* ---------- 📸 기록하기 ---------- */
  const capture = (which: 'a' | 'b') => (image: string) => {
    const store = which === 'b' ? side : main;
    const s = which === 'b' ? sideS : mainS;
    const title =
      mode === 'mission'
        ? `미션 ${missionIndex + 1}. ${mission.title}`
        : mode === 'free'
          ? '자유 실험'
          : `비교하기 – 회로 ${which === 'a' ? '가' : '나'}`;
    const entry: NoteEntry = {
      id: `n${Date.now().toString(36)}`,
      time: Date.now(),
      title,
      image,
      facts: factsFor(store.circuit, s.sol, s.arr, mode === 'mission' ? mission : undefined, predictions[mission.id], obs),
      note: '',
    };
    setNotebook((n) => [...n.slice(-19), entry]);
    say('📒 기록장에 저장했어요!');
  };

  const highlight = (s: { hint: ReturnType<typeof diagnose> }): Highlight | null =>
    hintLevel >= 2 ? { parts: s.hint.parts, vertices: s.hint.vertices } : null;

  const tabs = [
    ['mission', '🎯 미션'],
    ['free', '🧪 자유 실험'],
    ['compare', '⚖️ 비교하기'],
  ] as const;

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="logo" aria-hidden="true">💡</span>
            <span className="brand-name">반짝 회로 실험실</span>
          </div>
          {locked ? (
            <div className="locked-badge">🔒 선생님이 정한 {shared.m === 'free' ? '자유 실험' : `미션 ${sharedMissionIndex + 1}`}</div>
          ) : (
            <nav className="tabs" role="tablist">
              {tabs.map(([m, label]) => (
                <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                  {label}
                </button>
              ))}
            </nav>
          )}
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
            <button
              className={viewMode === 'symbol' ? 'on' : ''}
              onClick={() => setViewMode(viewMode === 'symbol' ? 'real' : 'symbol')}
              aria-pressed={viewMode === 'symbol'}
              title="회로도 기호로 보기"
            >
              🔣<span className="lbl"> 회로도</span>
            </button>
            <button onClick={resetActive} title="처음부터">
              🧹<span className="lbl"> 처음부터</span>
            </button>
            <button onClick={() => setDialog('notebook')} title="관찰 기록장">
              📒<span className="lbl"> 기록장</span>
              {notebook.length > 0 && <span className="count">{notebook.length}</span>}
            </button>
            {!locked && (
              <button onClick={() => setDialog('teacher')} title="선생님 도구">
                👩‍🏫<span className="lbl"> 선생님</span>
              </button>
            )}
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
              mode={viewMode}
              showNumbers={showNumbers}
              onCapture={capture('a')}
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
                mode={viewMode}
                showNumbers={showNumbers}
                onCapture={capture('b')}
              />
            )}
          </section>

          <aside className="panel">
            {mode === 'mission' && (
              <MissionPanel
                missions={MISSIONS}
                index={missionIndex}
                setIndex={setMissionIndex}
                locked={locked}
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
                <div>부품을 마음껏 꺼내 여러 가지 회로를 만들어 보세요. 전지를 두 개 쓰면 어떻게 될까요? 전자석에 전구를 함께 이으면?</div>
              </div>
            )}
            {mode === 'compare' && <CompareSummary a={main.circuit} b={side.circuit} sa={mainS.sol} sb={sideS.sol} />}

            {!(mode === 'mission' && done) && <HintBox hint={activeS.hint} level={hintLevel} setLevel={setHintLevel} />}
            {mode !== 'compare' && <BulbSummary circuit={active.circuit} sol={activeS.sol} arr={activeS.arr} />}
            <ReferenceCard />
          </aside>
        </main>

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        {dialog === 'notebook' && (
          <NotebookModal entries={notebook} setEntries={setNotebook} name={studentName} setName={setStudentName} onClose={() => setDialog(null)} />
        )}
        {dialog === 'teacher' && (
          <TeacherModal
            missions={MISSIONS}
            currentMission={mode === 'mission' ? mission.id : 'free'}
            circuit={active.circuit}
            showNumbers={localNumbers}
            setShowNumbers={setLocalNumbers}
            onClearAll={() => {
              clearAll();
              location.reload();
            }}
            onClose={() => setDialog(null)}
          />
        )}
      </div>
      <PrintSheet
        entries={notebook}
        name={studentName}
        completed={MISSIONS.filter((m) => completed[m.id]).map((m) => m.title)}
      />
    </>
  );
}

/** 기록장에 함께 적어 둘 관찰 결과 */
function factsFor(c: Circuit, sol: Solution, arr: Arrangement, mission?: Mission, prediction?: number, obs: Observed = {}): string[] {
  const facts: string[] = [];
  const bulbs = c.parts.filter((p) => p.kind === 'bulb');
  if (bulbs.length) {
    if (bulbs.length > 1) facts.push(`연결: ${ARRANGEMENT_NAME[arr]}`);
    bulbs.forEach((b, i) => {
      const n = b.removed ? -1 : stars(sol.brightness[b.id] ?? 0);
      facts.push(`전구 ${i + 1}: ${n < 0 ? '빠짐' : n === 0 ? '꺼짐' : `밝기 ${'★'.repeat(n)}${'☆'.repeat(5 - n)}`}`);
    });
  }
  const batteries = c.parts.filter((p) => p.kind === 'battery').length;
  if (batteries) facts.push(`전지: ${batteries}개`);
  c.parts
    .filter((p) => p.kind === 'coil')
    .forEach((p) => {
      const m = sol.magnet[p.id];
      facts.push(
        `전자석(코일 ${p.turns === 2 ? '많이' : '적게'} 감음): 클립 ${m?.clips ?? 0}개${m?.pole ? `, 철못 끝이 ${m.pole === 1 ? 'N' : 'S'}극` : ''}`,
      );
    });
  if (obs.tested && Object.keys(obs.tested).length) {
    const t = Object.entries(obs.tested) as [keyof typeof MATERIALS, boolean][];
    const yes = t.filter(([, v]) => v).map(([k]) => MATERIALS[k].name);
    const no = t.filter(([, v]) => !v).map(([k]) => MATERIALS[k].name);
    if (yes.length) facts.push(`전기가 통하는 물체: ${yes.join(', ')}`);
    if (no.length) facts.push(`전기가 통하지 않는 물체: ${no.join(', ')}`);
  }
  if (sol.short) facts.push('⚠️ 합선된 회로');
  if (mission?.prediction && prediction !== undefined) {
    facts.push(`내 예상: ${mission.prediction.options[prediction]}`);
  }
  return facts;
}

function CompareSummary({ a, b, sa, sb }: { a: Circuit; b: Circuit; sa: Solution; sb: Solution }) {
  const best = (c: Circuit, s: Solution) => Math.max(0, ...litBulbs(c, s).map((p) => s.brightness[p.id]));
  const na = stars(best(a, sa));
  const nb = stars(best(b, sb));
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
