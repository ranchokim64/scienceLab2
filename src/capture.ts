import { bbox } from './engine/ops';
import { Circuit } from './engine/types';

/** 지금 회로를 그림(JPEG data URL)으로 만든다. 활동지·기록장에 붙이는 용도. */
export async function captureCircuit(svg: SVGSVGElement, circuit: Circuit, maxWidth = 1100): Promise<string | null> {
  const box = bbox(circuit);
  if (!box) return null;
  const pad = 70;
  const top = 120; // 전구 유리알·전자석 나침반이 꼭짓점보다 위로 올라온다
  const w = box.maxX - box.minX + pad * 2;
  const h = box.maxY - box.minY + pad + top;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.sel-ring, .hl-ring, .hl-dot, .hit').forEach((el) => el.remove());
  const world = clone.querySelector('[data-world]');
  world?.setAttribute('transform', `translate(${pad - box.minX} ${top - box.minY})`);
  clone.querySelector('[data-bg]')?.setAttribute('fill', '#ffffff');
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);

  let css = '';
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      css += Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join('\n');
    } catch {
      /* 다른 출처의 스타일은 읽을 수 없다 */
    }
  }
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('그림을 만들 수 없어요'));
      img.src = url;
    });
    const scale = Math.min(1.5, maxWidth / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
