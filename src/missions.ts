import { Arrangement, arrangement, litBulbs } from './engine/analysis';
import { Solution } from './engine/solver';
import { isLit } from './engine/analysis';
import { Circuit, MATERIAL_IDS, MaterialId, Part, PartKind } from './engine/types';

export interface Observed {
  /** 직렬 회로에서 전구를 빼 보았는지 */
  removedInSeries?: boolean;
  /** 병렬 회로에서 전구를 빼 보았는지 */
  removedInParallel?: boolean;
  /** 검사한 물체와 결과(전기가 통하는지) */
  tested?: Partial<Record<MaterialId, boolean>>;
  /** 전자석이 클립을 끌어당겼는지 */
  magnetOn?: boolean;
  /** 스위치를 열어 전자석이 자석의 성질을 잃는 것을 보았는지 */
  magnetOffBySwitch?: boolean;
  /** 지금까지 가장 많이 끌어당긴 클립 수 */
  maxClips?: number;
  /** 전자석의 극이 바뀌는 것을 보았는지 */
  poleFlipped?: boolean;
  /** 불이 켜진 회로를 기록장에 저장했는지 */
  captured?: boolean;
}

/** 비상교육 6학년 「전기의 이용」 차시 */
export interface Lesson {
  /** 예: '2차시' */
  name: string;
  title: string;
  /** 교과서 쪽수 */
  pages?: string;
}

export interface MissionContext {
  circuit: Circuit;
  sol: Solution;
  arrangement: Arrangement;
  observed: Observed;
}

export interface Prediction {
  question: string;
  options: string[];
  answer: number;
}

export interface Mission {
  id: string;
  title: string;
  lesson: Lesson;
  /** 학습 목표(성취기준과 연결) */
  goal: string;
  steps: string[];
  /** 부품 상자에 꺼낼 수 있는 개수. wire는 생략하면 무제한 */
  parts: Partial<Record<PartKind, number>>;
  preset?: () => Circuit;
  prediction?: Prediction;
  check: (ctx: MissionContext) => boolean;
  /** 성공했을 때 정리해 주는 개념 */
  success: string;
  /** 성공 화면에 밝기 비교를 보여줄지 */
  showBrightness?: boolean;
  /** 실험할 때 알아 둘 점 */
  tip?: string;
  /** 성공한 뒤 모둠·학급에서 이야기해 볼 질문 */
  discuss?: string[];
}

const L2: Lesson = { name: '2차시', title: '전구에 불을 켜려면 어떻게 해야 할까요', pages: '과학 14~15쪽 · 실험 관찰 12~13쪽' };
const L3: Lesson = { name: '3차시', title: '전구의 연결 방법에 따라 전구의 밝기는 어떻게 달라질까요', pages: '과학 16~17쪽 · 실험 관찰 14~15쪽' };
const L4: Lesson = { name: '4차시', title: '전기를 절약하고 안전하게 사용하는 방법을 알아볼까요', pages: '과학 18~19쪽 · 실험 관찰 16~17쪽' };
const L56: Lesson = { name: '5~7차시', title: '전자석을 알아볼까요', pages: '과학 20~23쪽 · 실험 관찰 18~21쪽' };
const L89: Lesson = { name: '8~9차시', title: '창의 융합: 전기 회로로 불을 켤 수 있는 카드 만들기', pages: '과학 24~25쪽 · 실험 관찰 22~23쪽' };
const EXTRA: Lesson = { name: '더 해 보기', title: '교과서 밖 심화 탐구' };

const switchControlsLight = ({ circuit, sol }: MissionContext) =>
  litBulbs(circuit, sol).length > 0 &&
  circuit.parts.some((p) => p.kind === 'switch' && p.closed && Math.abs(sol.current[p.id]) > 0.01);

/**
 * 6학년 「전기의 이용」 단원 미션 — 비상교육 교과서 차시 순서.
 * 순서·문구를 바꾸려면 이 배열만 고치면 된다.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'light',
    lesson: L2,
    title: '불을 켜라!',
    goal: '전지, 전선, 전구를 연결하여 전구에 불이 켜지는 조건을 찾을 수 있다.',
    steps: ['부품 상자에서 전지, 전구, 전선을 꺼내요.', '전선의 끝을 부품의 끝에 가져다 대면 착 붙어요.', '전구에 불이 켜지도록 연결해 보세요.'],
    parts: { battery: 1, bulb: 1 },
    check: ({ circuit, sol }) => litBulbs(circuit, sol).length > 0,
    success:
      '전지의 (+)극 → 전구 → 전지의 (−)극까지 끊어지지 않고 이어져야 전구에 불이 켜져요. 이렇게 전기 부품을 연결해 전기가 흐르도록 한 것을 「전기 회로」라고 해요.',
    discuss: ['전구에 불이 켜지지 않았던 연결 방법에는 어떤 것이 있었나요? 왜 켜지지 않았을까요?'],
  },
  {
    id: 'switch',
    lesson: L2,
    title: '스위치로 켜고 끄기',
    goal: '스위치를 사용하여 전기 회로를 이었다 끊었다 할 수 있다.',
    steps: ['전지, 전구, 스위치를 연결해 회로를 만들어요.', '스위치를 눌러 닫으면 불이 켜지는지 확인해요.'],
    parts: { battery: 1, bulb: 1, switch: 1 },
    check: switchControlsLight,
    success: '스위치를 닫으면 전기가 흐르는 길이 이어지고, 열면 길이 끊겨요. 그래서 스위치로 전구를 켜고 끌 수 있어요.',
  },
  {
    id: 'series',
    lesson: L3,
    title: '전구 두 개를 한 줄로 (직렬)',
    goal: '전구 두 개를 직렬로 연결하고 전구의 밝기를 비교할 수 있다.',
    steps: ['전구 두 개를 한 줄로 이어서, 전기가 흐르는 길이 하나가 되도록 만들어요.', '전구 1개일 때(별 3개)와 밝기를 비교해 보세요.'],
    parts: { battery: 1, bulb: 2 },
    prediction: {
      question: '전구 두 개를 한 줄로(직렬) 연결하면, 전구 1개일 때보다 밝기가 어떨까요?',
      options: ['더 밝다', '비슷하다', '더 어둡다'],
      answer: 2,
    },
    check: ({ circuit, sol, arrangement: arr }) => arr === 'series' && litBulbs(circuit, sol).length === 2,
    success: '전구 두 개 이상을 한 줄로 연결하는 방법을 「전구의 직렬연결」이라고 해요. 직렬연결한 전구는 전구 1개일 때보다 어두워요.',
    showBrightness: true,
  },
  {
    id: 'parallel',
    lesson: L3,
    title: '전구 두 개를 나란히 (병렬)',
    goal: '전구 두 개를 병렬로 연결하고 전구의 밝기를 비교할 수 있다.',
    steps: ['전구 두 개를 각각 다른 길에 나란히 놓아, 전기가 흐르는 길이 두 갈래가 되도록 만들어요.', '전구 1개일 때(별 3개)와 밝기를 비교해 보세요.'],
    parts: { battery: 1, bulb: 2 },
    prediction: {
      question: '전구 두 개를 나란히(병렬) 연결하면, 전구 1개일 때보다 밝기가 어떨까요?',
      options: ['더 밝다', '비슷하다', '더 어둡다'],
      answer: 1,
    },
    check: ({ circuit, sol, arrangement: arr }) => arr === 'parallel' && litBulbs(circuit, sol).length === 2,
    success:
      '전구 두 개 이상을 여러 개의 줄에 나누어 한 개씩 연결하는 방법을 「전구의 병렬연결」이라고 해요. 병렬연결한 전구는 전구 1개일 때와 밝기가 비슷하고, 직렬연결보다 밝아요.',
    showBrightness: true,
  },
  {
    id: 'remove',
    lesson: L3,
    title: '전구 하나를 빼면?',
    goal: '직렬연결과 병렬연결에서 전구 하나를 뺐을 때의 차이를 설명할 수 있다.',
    steps: [
      '직렬연결 회로를 만들고, 전구 하나를 눌러 「전구 빼기」를 해요.',
      '병렬연결 회로로 바꾸고, 다시 전구 하나를 빼 보세요.',
      '남은 전구는 어떻게 되었나요?',
    ],
    parts: { battery: 1, bulb: 2 },
    prediction: {
      question: '직렬연결한 회로에서 전구 하나를 빼면, 남은 전구는 어떻게 될까요?',
      options: ['그대로 켜져 있다', '꺼진다', '더 밝아진다'],
      answer: 1,
    },
    check: ({ observed }) => !!observed.removedInSeries && !!observed.removedInParallel,
    success:
      '직렬연결은 전기가 흐르는 길이 하나라서 전구 하나를 빼면 길이 끊겨 모두 꺼져요. 병렬연결은 길이 여러 갈래라서 하나를 빼도 나머지 전구는 켜져 있어요.',
    discuss: ['우리 집이나 교실의 전등은 직렬연결과 병렬연결 중 어느 것일까요? 그렇게 생각한 까닭은?'],
  },
  {
    id: 'safety',
    lesson: L4,
    title: '안전 탐정',
    goal: '전기를 안전하게 사용하는 방법을 말할 수 있다.',
    steps: ['이 회로에는 위험한 곳이 있어요. 전구에 불도 켜지지 않아요.', '위험한 곳을 찾아 고치고, 전구에 불을 켜 보세요.'],
    parts: { battery: 1, bulb: 1 },
    preset: safetyPreset,
    check: ({ circuit, sol }) => !sol.short && litBulbs(circuit, sol).length > 0,
    success:
      '전지의 두 극을 전선으로 바로 이으면(합선) 큰 전기가 흘러 전선이 뜨거워지고 불이 날 수도 있어요. 콘센트에 쇠붙이를 넣거나 젖은 손으로 전기 제품을 만지지 않아요.',
    discuss: [
      '우리 생활에서 전기를 위험하게 사용하는 모습을 본 적이 있나요?',
      '전기를 안전하게 사용하는 방법을 세 가지 이야기해 봐요. (예: 콘센트 하나에 플러그를 많이 꽂지 않기)',
    ],
  },
  {
    id: 'saving',
    lesson: L4,
    title: '전기 절약 탐정',
    goal: '전기를 절약하는 방법을 말할 수 있다.',
    steps: [
      '집 안의 공부방, 거실, 화장실 전등이 모두 켜져 있어요.',
      '지금은 공부방에만 사람이 있어요. 필요 없는 전등을 스위치로 꺼 보세요.',
      '켜진 전등 수에 따라 전지가 얼마나 빨리 닳는지 살펴보세요.',
    ],
    parts: { battery: 1, bulb: 3, switch: 3 },
    preset: savingPreset,
    prediction: {
      question: '켜진 전등을 줄이면 전지에서 나가는 전기는 어떻게 될까요?',
      options: ['늘어난다', '줄어든다', '그대로다'],
      answer: 1,
    },
    check: ({ circuit, sol }) => {
      const bulbs = circuit.parts.filter((p) => p.kind === 'bulb');
      const study = bulbs.find((b) => b.label === '공부방');
      return bulbs.length === 3 && !!study && isLit(sol, study.id) && litBulbs(circuit, sol).length === 1;
    },
    success:
      '전등을 많이 켤수록 전지에서 전기가 많이 나가서 전지가 빨리 닳아요. 쓰지 않는 전등을 끄면 전기를 절약할 수 있어요. 각 방의 전등을 따로 켜고 끌 수 있는 것은 전등이 병렬로 연결되어 있기 때문이에요.',
    discuss: ['학교와 집에서 전기를 절약하는 방법을 찾아봐요. (예: 쓰지 않는 플러그 뽑기)', '전기를 절약하면 어떤 점이 좋을까요?'],
  },
  {
    id: 'magnet',
    lesson: L56,
    title: '전자석 만들기',
    goal: '전자석을 만들어 전기가 흐를 때만 자석의 성질이 생기는 것을 알 수 있다.',
    steps: [
      '전지, 스위치, 전자석(에나멜선을 감은 철못)을 연결해요.',
      '스위치를 닫아 클립이 붙는지 살펴요.',
      '스위치를 다시 열면 클립이 어떻게 되는지 보세요.',
    ],
    parts: { battery: 1, switch: 1, coil: 1 },
    prediction: {
      question: '스위치를 열면 철못에 붙어 있던 클립은 어떻게 될까요?',
      options: ['그대로 붙어 있다', '떨어진다', '더 많이 붙는다'],
      answer: 1,
    },
    check: ({ observed }) => !!observed.magnetOn && !!observed.magnetOffBySwitch,
    success: '전기가 흐르는 전선 주위에 자석의 성질이 생기는 것을 이용해 만든 자석을 「전자석」이라고 해요. 전자석은 전기가 흐를 때만 자석의 성질이 나타나요.',
    tip: '전자석 회로에는 전기가 많이 흘러 전지가 빨리 닳아요. 실제 실험에서는 관찰이 끝나면 스위치를 열어요.',
  },
  {
    id: 'magnet-power',
    lesson: L56,
    title: '전자석의 세기와 극',
    goal: '전자석의 세기를 바꾸고, 전지의 방향에 따라 극이 바뀌는 것을 알 수 있다.',
    steps: [
      '전자석이 클립을 6개 이상 끌어당기도록 만들어 보세요. (힌트: 코일 감은 수, 전지 개수)',
      '전지를 눌러 「방향 바꾸기」를 하고 나침반 바늘과 N극·S극을 살펴보세요.',
    ],
    parts: { battery: 2, switch: 1, coil: 1 },
    prediction: {
      question: '전지의 방향을 반대로 바꾸면 나침반 바늘은 어떻게 될까요?',
      options: ['그대로 있다', '반대쪽을 가리킨다', '빙글빙글 돈다'],
      answer: 1,
    },
    check: ({ observed }) => (observed.maxClips ?? 0) >= 6 && !!observed.poleFlipped,
    success:
      '전자석은 직렬로 연결한 전지의 개수가 많을수록, 코일을 많이 감을수록 세져요. 전지의 방향을 바꾸면 전자석의 극도 바뀌어요. 영구 자석과 달리 전자석은 세기와 극을 바꿀 수 있어요.',
    tip: '전지 두 개는 서로 다른 극끼리 한 줄로(직렬로) 이어야 전자석이 세져요.',
    discuss: [
      '7차시: 우리 생활에서 전자석을 사용하는 물건을 조사해 봐요. (예: 전자석 기중기, 스피커, 선풍기, 자기 부상 열차, 전기 자동차)',
      '그 물건은 전자석의 어떤 성질(켜고 끌 수 있음, 세기·극을 바꿀 수 있음)을 이용할까요?',
    ],
  },
  {
    id: 'card',
    lesson: L89,
    title: '불이 켜지는 카드 설계하기',
    goal: '전기 회로를 활용하여 불이 켜지는 카드를 설계할 수 있다.',
    steps: [
      '카드를 펼치거나 누르면 불이 켜지도록, 스위치가 있는 회로를 자유롭게 설계해요.',
      '전구 여러 개를 쓴다면 직렬과 병렬 중 무엇이 좋을지 생각해요.',
      '🔣 회로도로 바꿔 설계도를 확인하고, 불이 켜진 상태에서 📸 기록하기를 눌러요.',
      '📒 기록장에서 설계도를 인쇄해 실제 카드를 만들 때 써요.',
    ],
    parts: { battery: 2, bulb: 3, switch: 2 },
    check: (ctx) => switchControlsLight(ctx) && !!ctx.observed.captured,
    success: '설계도 완성! 기록장에서 인쇄해 실제 카드를 만들어 보세요. 스위치 대신 알루미늄 포일 두 장이 카드를 접고 펼 때 닿았다 떨어지게 만들 수도 있어요.',
    discuss: ['내 카드에서 스위치는 어떤 역할을 하나요?', '친구의 설계도와 비교해 보고, 더 밝게 하거나 전지를 아끼는 방법을 이야기해 봐요.'],
  },
  {
    id: 'conductor',
    lesson: EXTRA,
    title: '전기가 통하는 물체 찾기',
    goal: '전기가 통하는 물체와 전기가 통하지 않는 물체를 구분할 수 있다.',
    steps: [
      '전지, 전구, 「검사할 물체」를 한 줄로 이어 회로를 만들어요.',
      '물체를 누르고 아래에서 다른 물체로 바꿔 가며 전구에 불이 켜지는지 살펴요.',
      '6가지 물체를 모두 검사해 보세요.',
    ],
    parts: { battery: 1, bulb: 1, object: 1 },
    prediction: {
      question: '철 클립, 알루미늄 포일, 동전, 지우개, 플라스틱 자, 나무젓가락 중 전기가 통하는 것은 무엇으로 만든 물체일까요?',
      options: ['금속으로 만든 물체', '금속이 아닌 물체', '모두 통한다'],
      answer: 0,
    },
    check: ({ observed }) => MATERIAL_IDS.every((m) => observed.tested?.[m] !== undefined),
    success:
      '철, 알루미늄, 구리 같은 금속으로 만든 물체는 전기가 통해요. 고무, 플라스틱, 나무로 만든 물체는 전기가 통하지 않아요. 그래서 전선은 구리선을 플라스틱으로 감싸 만들어요.',
  },
];

function safetyPreset(): Circuit {
  const v = (id: string, x: number, y: number) => ({ id, x, y });
  return {
    vertices: {
      bn: v('bn', 260, 340),
      bp: v('bp', 380, 340),
      ln: v('ln', 270, 150),
      lp: v('lp', 370, 150),
      j: v('j', 320, 450),
    },
    parts: [
      { id: 'pb', kind: 'battery', a: 'bn', b: 'bp' },
      { id: 'pl', kind: 'bulb', a: 'ln', b: 'lp' },
      { id: 'w1', kind: 'wire', a: 'bp', b: 'lp' },
      { id: 'w2', kind: 'wire', a: 'bn', b: 'ln' },
      { id: 'w3', kind: 'wire', a: 'bn', b: 'j' },
      { id: 'w4', kind: 'wire', a: 'j', b: 'bp' },
    ],
  };
}

/** 공부방·거실·화장실 전등이 병렬로 연결되고, 방마다 스위치가 있는 회로 */
function savingPreset(): Circuit {
  const vertices: Circuit['vertices'] = {};
  const parts: Part[] = [];
  const v = (id: string, x: number, y: number) => (vertices[id] = { id, x, y });
  const rooms = ['공부방', '거실', '화장실'];
  rooms.forEach((label, i) => {
    const y = 110 + i * 135;
    v(`L${i}`, 150, y);
    v(`sa${i}`, 200, y);
    v(`sb${i}`, 300, y);
    v(`la${i}`, 360, y);
    v(`lb${i}`, 460, y);
    v(`R${i}`, 520, y);
    parts.push(
      { id: `wl${i}`, kind: 'wire', a: `L${i}`, b: `sa${i}` },
      { id: `s${i}`, kind: 'switch', a: `sa${i}`, b: `sb${i}`, closed: true },
      { id: `wm${i}`, kind: 'wire', a: `sb${i}`, b: `la${i}` },
      { id: `l${i}`, kind: 'bulb', a: `la${i}`, b: `lb${i}`, label },
      { id: `wr${i}`, kind: 'wire', a: `lb${i}`, b: `R${i}` },
    );
    if (i > 0) parts.push({ id: `rl${i}`, kind: 'wire', a: `L${i - 1}`, b: `L${i}` }, { id: `rr${i}`, kind: 'wire', a: `R${i - 1}`, b: `R${i}` });
  });
  v('bn', 275, 520);
  v('bp', 395, 520);
  v('LB', 150, 520);
  v('RB', 520, 520);
  parts.push(
    { id: 'bat', kind: 'battery', a: 'bn', b: 'bp' },
    { id: 'wbn', kind: 'wire', a: 'LB', b: 'bn' },
    { id: 'wbp', kind: 'wire', a: 'bp', b: 'RB' },
    { id: 'rlb', kind: 'wire', a: 'L2', b: 'LB' },
    { id: 'rrb', kind: 'wire', a: 'R2', b: 'RB' },
  );
  return { vertices, parts };
}

export { arrangement };
