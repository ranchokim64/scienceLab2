export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** 글을 소리 내어 읽어 준다(한국어). 지원하지 않는 기기에서는 아무 일도 하지 않는다. */
export function speak(text: string) {
  try {
    const s = window.speechSynthesis;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    s.speak(u);
  } catch {
    /* 무시 */
  }
}
