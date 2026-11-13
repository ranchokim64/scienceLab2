import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'react';
import { Circuit } from '../engine/types';
import { Mission } from '../missions';
import { buildShareUrl, encodeCircuit } from '../share';

interface Props {
  missions: Mission[];
  currentMission: string;
  circuit: Circuit;
  showNumbers: boolean;
  setShowNumbers: (b: boolean) => void;
  onClearAll: () => void;
  onClose: () => void;
}

export function TeacherModal({ missions, currentMission, circuit, showNumbers, setShowNumbers, onClearAll, onClose }: Props) {
  const [m, setM] = useState(currentMission);
  const [withCircuit, setWithCircuit] = useState(false);
  const [lock, setLock] = useState(true);
  const [num, setNum] = useState(false);
  const [sym, setSym] = useState(false);
  const [big, setBig] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasCircuit = circuit.parts.length > 0;

  const url = useMemo(
    () =>
      buildShareUrl(location.origin + location.pathname, {
        m,
        lock,
        num,
        sym,
        c: withCircuit && hasCircuit && m !== 'quiz' ? encodeCircuit(circuit) : undefined,
      }),
    [m, lock, num, sym, withCircuit, hasCircuit, circuit],
  );

  const qrSvg = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    } catch {
      return '';
    }
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="선생님 도구">
        <header className="modal-head">
          <h2>👩‍🏫 선생님 도구</h2>
          <button className="ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <section className="card">
          <div className="card-title">🔗 수업 링크 · QR 만들기</div>
          <div className="muted">학생들이 이 링크나 QR로 들어오면 아래에서 고른 미션으로 바로 시작해요.</div>
          <label className="row">
            시작할 활동
            <select value={m} onChange={(e) => setM(e.target.value)}>
              {missions.map((mm, i) => (
                <option key={mm.id} value={mm.id}>
                  [{mm.lesson.name}] 미션 {i + 1}. {mm.title}
                </option>
              ))}
              <option value="quiz">[10차시] 📝 스스로 확인하기 퀴즈</option>
              <option value="free">🧪 자유 실험</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={withCircuit && m !== 'quiz'} disabled={!hasCircuit || m === 'quiz'} onChange={(e) => setWithCircuit(e.target.checked)} />
            지금 화면의 회로를 시작 회로로 함께 보내기 {!hasCircuit && <span className="muted">(회로가 비어 있어요)</span>}
          </label>
          <label className="check">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
            🔒 다른 미션이나 모드로 못 가게 잠그기
          </label>
          <label className="check">
            <input type="checkbox" checked={num} onChange={(e) => setNum(e.target.checked)} />
            🔢 전압·전류 숫자 보이기 (심화)
          </label>
          <label className="check">
            <input type="checkbox" checked={sym} onChange={(e) => setSym(e.target.checked)} />
            🔣 회로도 기호로 보기 (심화)
          </label>
          <div className="share">
            <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div className="share-side">
              <input className="url" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="수업 링크" />
              <button className="primary" onClick={copy}>
                {copied ? '✅ 복사했어요' : '📋 링크 복사'}
              </button>
              <button onClick={() => setBig(true)}>🔍 QR 크게 보기 (TV·칠판용)</button>
              <a className="btn" href={url} target="_blank" rel="noreferrer">
                ↗ 새 탭에서 열어 보기
              </a>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">⚙️ 이 기기 설정</div>
          <label className="check">
            <input type="checkbox" checked={showNumbers} onChange={(e) => setShowNumbers(e.target.checked)} />
            🔢 전압·전류 숫자 보이기
          </label>
          <button className="danger" onClick={() => window.confirm('이 기기에 저장된 회로, 미션 기록, 관찰 기록장을 모두 지울까요?') && onClearAll()}>
            🧹 이 기기의 학습 기록 모두 지우기
          </button>
          <div className="muted">잠긴 링크를 풀려면 주소 끝의 # 뒷부분을 지우고 다시 열면 돼요.</div>
        </section>
      </div>

      {big && (
        <div className="qr-big" onPointerDown={() => setBig(false)} role="dialog" aria-label="QR 크게 보기">
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="qr-caption">📱 태블릿 카메라로 QR을 찍어 들어와요</div>
          <div className="muted">화면을 누르면 닫혀요</div>
        </div>
      )}
    </div>
  );
}
