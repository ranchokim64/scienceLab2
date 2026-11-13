import { Speak } from './Panels';

export interface NoteEntry {
  id: string;
  time: number;
  title: string;
  /** 회로 그림 (퀴즈 결과처럼 그림이 없는 기록도 있다) */
  image?: string;
  facts: string[];
  note: string;
}

interface Props {
  entries: NoteEntry[];
  setEntries: (fn: (e: NoteEntry[]) => NoteEntry[]) => void;
  name: string;
  setName: (s: string) => void;
  onClose: () => void;
}

const fmt = (t: number) =>
  new Date(t).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function NotebookModal({ entries, setEntries, name, setName, onClose }: Props) {
  const update = (id: string, patch: Partial<NoteEntry>) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="관찰 기록장">
        <header className="modal-head">
          <h2>📒 관찰 기록장</h2>
          <button className="ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>
        <div className="notebook-tools">
          <label>
            이름 <input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름을 써요" maxLength={20} />
          </label>
          <button className="primary" onClick={() => window.print()} disabled={!entries.length}>
            🖨️ 활동지 인쇄 · PDF 저장
          </button>
        </div>
        {entries.length === 0 ? (
          <div className="empty">
            실험 판 아래쪽의 <b>📸 기록하기</b>를 누르면 지금 회로 그림과 결과가 여기에 저장돼요.
          </div>
        ) : (
          <ol className="entries">
            {entries.map((e, i) => (
              <li key={e.id} className="entry">
                <div className="entry-head">
                  <b>
                    {i + 1}. {e.title}
                  </b>
                  <span className="muted">{fmt(e.time)}</span>
                </div>
                {e.image && <img src={e.image} alt={`${e.title} 회로 그림`} />}
                <ul className="facts">
                  {e.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <label className="note-label">
                  ✏️ 알게 된 점 <Speak text={e.facts.join('. ')} />
                  <textarea value={e.note} onChange={(ev) => update(e.id, { note: ev.target.value })} rows={3} placeholder="실험하며 알게 된 점을 써 보세요." />
                </label>
                <div className="entry-actions">
                  {e.image && (
                    <a className="btn" href={e.image} download={`회로-${i + 1}.jpg`}>
                      🖼 그림 저장
                    </a>
                  )}
                  <button
                    className="danger"
                    onClick={() => window.confirm('이 기록을 지울까요?') && setEntries((es) => es.filter((x) => x.id !== e.id))}
                  >
                    🗑 지우기
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

/** 인쇄할 때만 보이는 활동지 */
export function PrintSheet({ entries, name, completed }: { entries: NoteEntry[]; name: string; completed: string[] }) {
  return (
    <div className="print-sheet" aria-hidden="true">
      <h1>💡 반짝 회로 실험실 활동지</h1>
      <div className="print-meta">
        <span>6학년 「전기의 이용」</span>
        <span>이름: {name || '____________'}</span>
        <span>날짜: {new Date().toLocaleDateString('ko-KR')}</span>
      </div>
      {completed.length > 0 && <div className="print-done">✅ 성공한 미션: {completed.join(', ')}</div>}
      {entries.map((e, i) => (
        <section key={e.id} className="print-entry">
          <h2>
            {i + 1}. {e.title}
          </h2>
          <div className="print-row">
            {e.image && <img src={e.image} alt="" />}
            <ul>
              {e.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="print-note">
            <b>알게 된 점</b>
            <p>{e.note || ' '}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
