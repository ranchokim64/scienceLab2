import { ARRANGEMENT_NAME, Arrangement, Hint, litBulbs } from '../engine/analysis';
import { Solution, stars } from '../engine/solver';
import { Circuit, MATERIALS, MATERIAL_IDS } from '../engine/types';
import { Mission, Observed } from '../missions';
import { canSpeak, speak } from '../speak';

export function Speak({ text }: { text: string }) {
  if (!canSpeak) return null;
  return (
    <button className="speak" onClick={() => speak(text)} aria-label="소리로 듣기" title="소리로 듣기">
      🔊
    </button>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars-inline" aria-label={`별 ${n}개`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < n ? 'on' : 'off'}>★</span>
      ))}
    </span>
  );
}

export function ReferenceCard() {
  return (
    <div className="card ref">
      <div className="card-title">💡 밝기 기준</div>
      <div>
        전지 1개 + 전구 1개 = <Stars n={3} />
      </div>
      <div className="muted">별이 많을수록 전구가 밝아요.</div>
    </div>
  );
}

export function BulbSummary({ circuit, sol, arr }: { circuit: Circuit; sol: Solution; arr: Arrangement }) {
  const bulbs = circuit.parts.filter((p) => p.kind === 'bulb');
  if (!bulbs.length) return null;
  return (
    <div className="card">
      <div className="card-title">🔎 지금 회로</div>
      <div className="arr">{ARRANGEMENT_NAME[arr]}</div>
      <ul className="bulb-list">
        {bulbs.map((b, i) => (
          <li key={b.id}>
            전구 {i + 1}: {b.removed ? <span className="muted">빠짐</span> : <Stars n={stars(sol.brightness[b.id] ?? 0)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface HintProps {
  hint: Hint;
  level: number;
  setLevel: (n: number) => void;
}

export function HintBox({ hint, level, setLevel }: HintProps) {
  if (hint.tone === 'ok') {
    return (
      <div className="card hint ok">
        <div className="card-title">✅ {hint.question}</div>
        <div>{hint.detail}</div>
      </div>
    );
  }
  return (
    <div className={`card hint ${level > 0 ? hint.tone : ''}`}>
      {level === 0 ? (
        <button className="big" onClick={() => setLevel(1)}>
          🤔 왜 안 켜질까?
        </button>
      ) : (
        <>
          <div className="card-title">
            🤔 {hint.question} <Speak text={level > 1 ? `${hint.question} ${hint.detail}` : hint.question} />
          </div>
          {level === 1 ? (
            <button onClick={() => setLevel(2)}>📍 어디인지 보여줘</button>
          ) : (
            <>
              <div>{hint.detail}</div>
              <button className="ghost small" onClick={() => setLevel(0)}>
                힌트 닫기
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface MissionProps {
  missions: Mission[];
  index: number;
  setIndex: (i: number) => void;
  locked?: boolean;
  completed: Record<string, boolean>;
  prediction?: number;
  setPrediction: (n: number | undefined) => void;
  done: boolean;
  waitingPrediction: boolean;
  observed: Observed;
  circuit: Circuit;
  sol: Solution;
  arr: Arrangement;
}

export function MissionPanel({ missions, index, setIndex, locked, completed, prediction, setPrediction, done, waitingPrediction, observed, circuit, sol, arr }: MissionProps) {
  const m = missions[index];
  const pr = m.prediction;
  return (
    <>
      <nav className="mission-chips" aria-label="미션 고르기">
        {groupByLesson(missions).map(({ lesson, items }) => (
          <div key={lesson} className="chip-group">
            <div className="chip-group-label">{lesson}</div>
            <div className="chip-row">
              {items.map(({ m: mm, i }) => (
                <button
                  key={mm.id}
                  className={`chip ${i === index ? 'on' : ''} ${completed[mm.id] ? 'done' : ''}`}
                  onClick={() => setIndex(i)}
                  disabled={locked && i !== index}
                  title={mm.title}
                  aria-label={`미션 ${i + 1}. ${mm.title}`}
                >
                  {completed[mm.id] ? '✓' : i + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="card mission">
        <div className="mission-no">
          미션 {index + 1} · {m.lesson.name}
        </div>
        <h2>
          {m.title} <Speak text={`${m.title}. ${m.steps.join(' ')}`} />
        </h2>
        <div className="goal">🎯 {m.goal}</div>
        {m.lesson.pages && <div className="lesson-ref">📘 비상 {m.lesson.pages}</div>}
        <ol className="steps">
          {m.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {m.tip && <div className="tip">💡 {m.tip}</div>}
      </div>

      {waitingPrediction && (
        <div className="card hint info" role="status">
          <div className="card-title">⏸ 회로가 완성됐어요!</div>
          결과를 확인하기 전에 아래에서 예상을 먼저 골라 보세요.
        </div>
      )}

      {pr && (
        <div className={`card predict ${prediction === undefined ? 'need' : ''}`}>
          <div className="card-title">
            🔮 먼저 예상해 봐요 <Speak text={pr.question} />
          </div>
          <div>{pr.question}</div>
          <div className="options">
            {pr.options.map((o, i) => (
              <button key={o} className={prediction === i ? 'picked' : ''} disabled={done} onClick={() => setPrediction(i)}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      {m.id === 'conductor' && (
        <div className="card">
          <div className="card-title">📝 검사 결과</div>
          <table className="cmp">
            <tbody>
              {MATERIAL_IDS.map((id) => {
                const r = observed.tested?.[id];
                return (
                  <tr key={id}>
                    <th>{MATERIALS[id].name}</th>
                    <td>{r === undefined ? <span className="muted">아직 안 함</span> : r ? <b className="yes">⚡ 통한다</b> : <b className="no">✋ 안 통한다</b>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {m.id.startsWith('magnet') && (
        <div className="card">
          <div className="card-title">📝 관찰 기록</div>
          {m.id === 'magnet' ? (
            <>
              <div>{observed.magnetOn ? '✅' : '⬜'} 스위치를 닫아 클립 끌어당기기</div>
              <div>{observed.magnetOffBySwitch ? '✅' : '⬜'} 스위치를 열어 클립이 떨어지는 것 보기</div>
            </>
          ) : (
            <>
              <div>
                {(observed.maxClips ?? 0) >= 6 ? '✅' : '⬜'} 클립 6개 이상 끌어당기기 (지금까지 최고 {observed.maxClips ?? 0}개)
              </div>
              <div>{observed.poleFlipped ? '✅' : '⬜'} 전자석의 극이 바뀌는 것 보기</div>
            </>
          )}
        </div>
      )}

      {m.id === 'saving' && <BatteryMeter circuit={circuit} sol={sol} />}

      {m.id === 'remove' && (
        <div className="card">
          <div className="card-title">📝 관찰 기록</div>
          <div>{observed.removedInSeries ? '✅' : '⬜'} 직렬연결에서 전구 빼 보기 {observed.removedInSeries && <b>→ 남은 전구가 꺼졌어요</b>}</div>
          <div>{observed.removedInParallel ? '✅' : '⬜'} 병렬연결에서 전구 빼 보기 {observed.removedInParallel && <b>→ 남은 전구가 켜져 있어요</b>}</div>
        </div>
      )}

      {done && (
        <div className="card success" role="status">
          <div className="card-title">
            🎉 미션 성공! <Speak text={m.success} />
          </div>
          {pr && prediction !== undefined && (
            <div className={`predict-result ${prediction === pr.answer ? 'right' : 'wrong'}`}>
              내 예상: <b>{pr.options[prediction]}</b> → 실제 결과: <b>{pr.options[pr.answer]}</b>
              <div>{prediction === pr.answer ? '예상이 맞았어요! 👏' : '예상과 달랐어요. 왜 그런지 생각해 봐요.'}</div>
            </div>
          )}
          {m.showBrightness && (
            <div className="compare-stars">
              <div>
                전구 1개일 때: <Stars n={3} />
              </div>
              {litBulbs(circuit, sol).map((b, i) => (
                <div key={b.id}>
                  {ARRANGEMENT_NAME[arr]} 전구 {i + 1}: <Stars n={stars(sol.brightness[b.id])} />
                </div>
              ))}
            </div>
          )}
          <p>{m.success}</p>
          {m.discuss && (
            <div className="discuss">
              <div className="card-title">
                💬 이야기해 봐요 <Speak text={m.discuss.join(' ')} />
              </div>
              <ul>
                {m.discuss.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {index < missions.length - 1 ? (
            <button className="big primary" onClick={() => setIndex(index + 1)}>
              다음 미션 →
            </button>
          ) : (
            <div className="muted">모든 미션을 마쳤어요! 자유 실험에서 더 탐구해 보세요.</div>
          )}
        </div>
      )}
    </>
  );
}

function groupByLesson(missions: Mission[]) {
  const groups: { lesson: string; items: { m: Mission; i: number }[] }[] = [];
  missions.forEach((m, i) => {
    const last = groups[groups.length - 1];
    if (last && last.lesson === m.lesson.name) last.items.push({ m, i });
    else groups.push({ lesson: m.lesson.name, items: [{ m, i }] });
  });
  return groups;
}

/** 전기 절약: 전지에서 나가는 전기의 양을 막대로 보여 준다 */
function BatteryMeter({ circuit, sol }: { circuit: Circuit; sol: Solution }) {
  const lit = litBulbs(circuit, sol).length;
  const total = circuit.parts
    .filter((p) => p.kind === 'battery')
    .reduce((s, p) => s + Math.abs(sol.current[p.id] ?? 0), 0);
  const level = Math.min(5, Math.round(total / 0.15));
  return (
    <div className="card">
      <div className="card-title">🔋 전지에서 나가는 전기</div>
      <div className="meter" aria-label={`전기 사용량 ${level}칸`}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={i < level ? 'on' : ''} />
        ))}
      </div>
      <div>
        켜진 전등 <b>{lit}개</b> → {level >= 3 ? '전지가 빨리 닳아요 😥' : level > 0 ? '전지를 아끼고 있어요 😊' : '전기가 흐르지 않아요'}
      </div>
    </div>
  );
}
