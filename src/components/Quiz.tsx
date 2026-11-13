import { useMemo, useState } from 'react';
import { degree } from '../engine/ops';
import { Circuit } from '../engine/types';
import { MISSIONS } from '../missions';
import { QUIZ, QuizQuestion, shuffled } from '../quiz';
import { PartView } from './PartView';
import { Speak } from './Panels';

const MARKS = ['㉠', '㉡', '㉢', '㉣'];

/** 문제 보기로 쓰는 작은 회로 그림 (결과는 숨긴 채로) */
function MiniCircuit({ circuit }: { circuit: Circuit }) {
  const vs = Object.values(circuit.vertices);
  const minX = Math.min(...vs.map((v) => v.x)) - 26;
  const maxX = Math.max(...vs.map((v) => v.x)) + 26;
  const minY = Math.min(...vs.map((v) => v.y)) - (circuit.parts.some((p) => p.kind === 'coil') ? 112 : 70);
  const maxY = Math.max(...vs.map((v) => v.y)) + 30;
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="mini-circuit" aria-hidden="true">
      {[...circuit.parts]
        .sort((p, q) => Number(p.kind !== 'wire') - Number(q.kind !== 'wire'))
        .map((p) => (
          <PartView
            key={p.id}
            part={p}
            a={circuit.vertices[p.a]}
            b={circuit.vertices[p.b]}
            brightness={0}
            hot={false}
            selected={false}
            highlighted={false}
            plain
          />
        ))}
      {vs.map((v) => (
        <circle key={v.id} className={`vertex-dot ${degree(circuit, v.id) > 1 ? 'joined-dot' : ''}`} cx={v.x} cy={v.y} r={degree(circuit, v.id) > 1 ? 6 : 8} />
      ))}
    </svg>
  );
}

interface Props {
  onGoMission: (missionId: string) => void;
  onSave: (facts: string[]) => void;
  best: number;
  setBest: (n: number) => void;
}

export function QuizView({ onGoMission, onSave, best, setBest }: Props) {
  const [round, setRound] = useState(1);
  const [ids, setIds] = useState<string[]>(() => QUIZ.map((q) => q.id));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);

  const questions = useMemo(() => ids.map((id) => QUIZ.find((q) => q.id === id)!), [ids]);
  const q = questions[index];
  const picked = q ? answers[q.id] : undefined;
  const options = useMemo(() => (q ? (q.kind === 'ox' ? q.options : shuffled(q.options, round * 31 + index * 7 + 3)) : []), [q, round, index]);

  const start = (only?: string[]) => {
    setIds(only ?? QUIZ.map((x) => x.id));
    setAnswers({});
    setIndex(0);
    setFinished(false);
    setSaved(false);
    setRound((r) => r + 1);
  };

  const score = questions.filter((x) => answers[x.id] === x.answer).length;
  const wrong = questions.filter((x) => answers[x.id] !== x.answer);

  const finish = () => {
    setFinished(true);
    if (questions.length === QUIZ.length) setBest(Math.max(best, score));
  };

  if (finished) {
    const ratio = score / questions.length;
    const topics = [...new Set(questions.map((x) => x.topic))].map((topic) => {
      const qs = questions.filter((x) => x.topic === topic);
      return { topic, lesson: qs[0].lesson, total: qs.length, ok: qs.filter((x) => answers[x.id] === x.answer).length };
    });
    const message = ratio === 1 ? '모두 맞혔어요! 전기 박사예요! 🏆' : ratio >= 0.8 ? '아주 잘했어요! 👏' : ratio >= 0.5 ? '잘했어요! 틀린 문제를 다시 살펴봐요.' : '미션을 다시 해 보고 한 번 더 도전해요! 💪';
    return (
      <div className="quiz">
        <div className="quiz-card result">
          <div className="quiz-tag">10차시 · 스스로 확인하기 결과</div>
          <div className="score">
            <b>{score}</b> / {questions.length}
          </div>
          <div className="score-msg">
            {message} <Speak text={`${questions.length}문제 중 ${score}문제를 맞혔어요. ${message}`} />
          </div>
          {questions.length === QUIZ.length && best > 0 && <div className="muted">지금까지 최고 점수: {Math.max(best, score)}점</div>}

          <table className="topics">
            <tbody>
              {topics.map((t) => (
                <tr key={t.topic}>
                  <th>
                    <span className="muted">{t.lesson}</span> {t.topic}
                  </th>
                  <td className="bar-cell">
                    <div className="bar">
                      <span style={{ width: `${(t.ok / t.total) * 100}%` }} />
                    </div>
                  </td>
                  <td>
                    {t.ok}/{t.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {wrong.length > 0 && (
            <div className="review">
              <h3>다시 살펴볼 문제</h3>
              {wrong.map((x) => (
                <div key={x.id} className="review-item">
                  <div className="review-q">❗ {x.question}</div>
                  <div className="review-answer">
                    정답:{' '}
                    {x.options.find((o) => o.id === x.answer)?.circuit ? (
                      <span className="review-fig">
                        <MiniCircuit circuit={x.options.find((o) => o.id === x.answer)!.circuit!} />
                      </span>
                    ) : (
                      <b>{answerLabel(x)}</b>
                    )}
                  </div>
                  <div className="muted">{x.explain}</div>
                  {x.mission && (
                    <button className="small" onClick={() => onGoMission(x.mission!)}>
                      🎯 미션 {MISSIONS.findIndex((m) => m.id === x.mission) + 1}에서 다시 해 보기
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="quiz-actions">
            {wrong.length > 0 && (
              <button className="primary" onClick={() => start(wrong.map((x) => x.id))}>
                ❗ 틀린 문제만 다시 풀기
              </button>
            )}
            <button onClick={() => start()}>🔁 처음부터 다시 풀기</button>
            <button
              disabled={saved}
              onClick={() => {
                onSave([
                  `점수: ${questions.length}문제 중 ${score}문제`,
                  ...topics.map((t) => `${t.topic}: ${t.ok}/${t.total}`),
                  ...(wrong.length ? [`다시 볼 내용: ${[...new Set(wrong.map((x) => x.topic))].join(', ')}`] : []),
                ]);
                setSaved(true);
              }}
            >
              {saved ? '✅ 저장했어요' : '📒 기록장에 결과 저장'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const correct = picked === q.answer;
  return (
    <div className="quiz">
      <div className="quiz-card" data-q={q.id}>
        <div className="quiz-top">
          <span className="quiz-tag">
            10차시 · 스스로 확인하기 · {q.lesson}
          </span>
          <span className="quiz-count">
            {index + 1} / {questions.length}
          </span>
        </div>
        <div className="progress">
          <span style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <h2 className="quiz-q">
          {q.kind === 'ox' && <span className="ox-tag">O / X</span>} {q.question} <Speak text={q.question} />
        </h2>

        <div className={`quiz-options kind-${q.kind}`} role="radiogroup" aria-label="보기">
          {options.map((o, i) => {
            const state = picked === undefined ? '' : o.id === q.answer ? 'right' : o.id === picked ? 'wrong' : 'dim';
            return (
              <button
                key={o.id}
                data-option={o.id}
                role="radio"
                aria-checked={picked === o.id}
                className={`quiz-option ${state}`}
                disabled={picked !== undefined}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
              >
                {q.kind !== 'ox' && <span className="mark">{MARKS[i]}</span>}
                {o.circuit ? <MiniCircuit circuit={o.circuit} /> : <span className="opt-text">{o.text}</span>}
              </button>
            );
          })}
        </div>

        {picked !== undefined && (
          <div className={`feedback ${correct ? 'right' : 'wrong'}`} role="status">
            <div className="card-title">
              {correct ? '⭕ 정답이에요!' : `❌ 아쉬워요. 정답은 ${q.kind === 'ox' ? answerLabel(q) : MARKS[options.findIndex((o) => o.id === q.answer)]}이에요.`}
              <Speak text={q.explain} />
            </div>
            <div>{q.explain}</div>
            <div className="quiz-actions">
              {!correct && q.mission && (
                <button className="small" onClick={() => onGoMission(q.mission!)}>
                  🎯 미션 {MISSIONS.findIndex((m) => m.id === q.mission) + 1}에서 다시 해 보기
                </button>
              )}
              {index < questions.length - 1 ? (
                <button className="primary" onClick={() => setIndex(index + 1)}>
                  다음 문제 →
                </button>
              ) : (
                <button className="primary" onClick={finish}>
                  결과 보기 🏁
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function answerLabel(q: QuizQuestion) {
  const o = q.options.find((x) => x.id === q.answer)!;
  if (o.text) return o.text.replace(/^[⭕❌]\s*/, '');
  return '회로 그림 보기';
}
