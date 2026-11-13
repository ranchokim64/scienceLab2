import { Circuit, Part } from './engine/types';

/** 10차시 단원 마무리 「스스로 확인하기」 문제 */
export interface QuizOption {
  id: string;
  text?: string;
  /** 회로 그림 보기 */
  circuit?: Circuit;
}

export interface QuizQuestion {
  id: string;
  lesson: string;
  /** 학습 주제(결과 화면에서 묶어 보여 줌) */
  topic: string;
  question: string;
  kind: 'choice' | 'ox' | 'circuit';
  options: QuizOption[];
  answer: string;
  explain: string;
  /** 틀렸을 때 다시 해 볼 미션 id */
  mission?: string;
}

/* ---------- 문제에 쓰는 회로 그림 ---------- */

function build(vs: [string, number, number][], ps: [Part['kind'], string, string, Partial<Part>?][]): Circuit {
  const vertices: Circuit['vertices'] = {};
  vs.forEach(([id, x, y]) => (vertices[id] = { id, x, y }));
  return { vertices, parts: ps.map(([kind, a, b, extra], i) => ({ id: `q${i}`, kind, a, b, ...extra })) };
}

/** 전지 (+)·(−)극에서 전구 양쪽으로 이어진 회로 */
export const closedLoop = () =>
  build(
    [['n', 0, 200], ['p', 120, 200], ['la', 10, 60], ['lb', 110, 60]],
    [['battery', 'n', 'p'], ['bulb', 'la', 'lb'], ['wire', 'p', 'lb'], ['wire', 'n', 'la']],
  );

/** 두 전선이 모두 전지의 (+)극에 이어진 회로 */
export const samePole = () =>
  build(
    [['n', 0, 200], ['p', 120, 200], ['la', 10, 60], ['lb', 110, 60]],
    [['battery', 'n', 'p'], ['bulb', 'la', 'lb'], ['wire', 'p', 'lb'], ['wire', 'la', 'p']],
  );

/** 전선 한 끝이 전지에 닿지 않은 회로 */
export const brokenLoop = () =>
  build(
    [['n', 0, 200], ['p', 120, 200], ['la', 10, 60], ['lb', 110, 60], ['g', -30, 160]],
    [['battery', 'n', 'p'], ['bulb', 'la', 'lb'], ['wire', 'p', 'lb'], ['wire', 'la', 'g']],
  );

export const seriesTwo = () =>
  build(
    [['n', 40, 220], ['p', 160, 220], ['a1', -20, 60], ['b1', 80, 60], ['a2', 120, 60], ['b2', 220, 60]],
    [['battery', 'n', 'p'], ['bulb', 'a1', 'b1'], ['bulb', 'a2', 'b2'], ['wire', 'b1', 'a2'], ['wire', 'n', 'a1'], ['wire', 'p', 'b2']],
  );

export const parallelTwo = () =>
  build(
    [['n', 40, 260], ['p', 160, 260], ['a1', 50, 150], ['b1', 150, 150], ['a2', 50, 40], ['b2', 150, 40]],
    [['battery', 'n', 'p'], ['bulb', 'a1', 'b1'], ['bulb', 'a2', 'b2'], ['wire', 'n', 'a1'], ['wire', 'p', 'b1'], ['wire', 'a1', 'a2'], ['wire', 'b1', 'b2']],
  );

export const magnetOneBattery = () =>
  build(
    [['n', 10, 220], ['p', 130, 220], ['c1', 0, 90], ['c2', 140, 90]],
    [['battery', 'n', 'p'], ['coil', 'c1', 'c2', { turns: 1 }], ['wire', 'p', 'c2'], ['wire', 'n', 'c1']],
  );

export const magnetTwoBatteries = () =>
  build(
    [['n', -60, 220], ['m', 60, 220], ['p', 180, 220], ['c1', 0, 90], ['c2', 140, 90]],
    [['battery', 'n', 'm'], ['battery', 'm', 'p'], ['coil', 'c1', 'c2', { turns: 1 }], ['wire', 'p', 'c2'], ['wire', 'n', 'c1']],
  );

const OX = [
  { id: 'o', text: '⭕ 맞아요' },
  { id: 'x', text: '❌ 아니에요' },
];

export const QUIZ: QuizQuestion[] = [
  {
    id: 'light-circuit',
    lesson: '2차시',
    topic: '전구에 불 켜기',
    kind: 'circuit',
    question: '전구에 불이 켜지는 회로를 고르세요.',
    options: [
      { id: 'same', circuit: samePole() },
      { id: 'loop', circuit: closedLoop() },
      { id: 'broken', circuit: brokenLoop() },
    ],
    answer: 'loop',
    explain: '전지의 (+)극과 (−)극에 전구의 양쪽이 끊어지지 않게 이어져야 불이 켜져요. 두 전선이 같은 극에 이어지거나, 끊어진 곳이 있으면 불이 켜지지 않아요.',
    mission: 'light',
  },
  {
    id: 'light-condition',
    lesson: '2차시',
    topic: '전구에 불 켜기',
    kind: 'choice',
    question: '전기 부품을 연결해 전기가 흐르도록 한 것을 무엇이라고 할까요?',
    options: [
      { id: 'circuit', text: '전기 회로' },
      { id: 'magnet', text: '전자석' },
      { id: 'battery', text: '전지 끼우개' },
    ],
    answer: 'circuit',
    explain: '전지, 전선, 전구 같은 전기 부품을 서로 연결해 전기가 흐르도록 한 것을 「전기 회로」라고 해요.',
    mission: 'light',
  },
  {
    id: 'switch-role',
    lesson: '2차시',
    topic: '전구에 불 켜기',
    kind: 'ox',
    question: '스위치를 열면 전기가 흐르는 길이 끊겨서 전구의 불이 꺼진다.',
    options: OX,
    answer: 'o',
    explain: '스위치는 전기가 흐르는 길을 이었다 끊었다 해요. 스위치를 닫으면 불이 켜지고, 열면 꺼져요.',
    mission: 'switch',
  },
  {
    id: 'series-name',
    lesson: '3차시',
    topic: '전구의 연결 방법',
    kind: 'choice',
    question: '전구 두 개 이상을 한 줄로 연결하는 방법을 무엇이라고 할까요?',
    options: [
      { id: 'series', text: '전구의 직렬연결' },
      { id: 'parallel', text: '전구의 병렬연결' },
      { id: 'short', text: '합선' },
    ],
    answer: 'series',
    explain: '전구를 한 줄로 연결하면 「직렬연결」, 여러 개의 줄에 나누어 한 개씩 연결하면 「병렬연결」이에요.',
    mission: 'series',
  },
  {
    id: 'brighter',
    lesson: '3차시',
    topic: '전구의 연결 방법',
    kind: 'circuit',
    question: '두 회로의 전지와 전구는 똑같아요. 전구가 더 밝은 회로를 고르세요.',
    options: [
      { id: 'series', circuit: seriesTwo() },
      { id: 'parallel', circuit: parallelTwo() },
    ],
    answer: 'parallel',
    explain: '병렬연결한 전구는 전구 1개일 때와 밝기가 비슷하고, 직렬연결한 전구보다 밝아요.',
    mission: 'parallel',
  },
  {
    id: 'remove-parallel',
    lesson: '3차시',
    topic: '전구의 연결 방법',
    kind: 'ox',
    question: '병렬연결한 전구 중 하나를 빼면 나머지 전구도 모두 꺼진다.',
    options: OX,
    answer: 'x',
    explain: '병렬연결은 전기가 흐르는 길이 여러 갈래라서 전구 하나를 빼도 나머지 전구는 켜져 있어요. 모두 꺼지는 것은 직렬연결이에요.',
    mission: 'remove',
  },
  {
    id: 'home-lights',
    lesson: '3차시',
    topic: '전구의 연결 방법',
    kind: 'choice',
    question: '우리 집 전등은 방마다 따로 켜고 끌 수 있어요. 전등은 어떻게 연결되어 있을까요?',
    options: [
      { id: 'series', text: '직렬연결' },
      { id: 'parallel', text: '병렬연결' },
    ],
    answer: 'parallel',
    explain: '전등이 병렬로 연결되어 있어서 한 전등을 꺼도 다른 전등은 켜져 있어요.',
    mission: 'saving',
  },
  {
    id: 'safety',
    lesson: '4차시',
    topic: '전기 안전과 절약',
    kind: 'choice',
    question: '전기를 안전하게 사용하는 방법이 아닌 것을 고르세요.',
    options: [
      { id: 'wet', text: '젖은 손으로 플러그를 만지지 않아요.' },
      { id: 'multi', text: '콘센트 하나에 플러그를 여러 개 꽂아 써요.' },
      { id: 'pull', text: '플러그를 뽑을 때 전선이 아니라 플러그 머리를 잡아요.' },
    ],
    answer: 'multi',
    explain: '콘센트 하나에 플러그를 여러 개 꽂으면 전선이 뜨거워져 불이 날 수 있어요.',
    mission: 'safety',
  },
  {
    id: 'short',
    lesson: '4차시',
    topic: '전기 안전과 절약',
    kind: 'ox',
    question: '전지의 (+)극과 (−)극을 전선으로 바로 이어도 안전하다.',
    options: OX,
    answer: 'x',
    explain: '전지의 두 극을 전선으로 바로 이으면(합선) 큰 전기가 흘러 전선이 뜨거워지고 위험해요.',
    mission: 'safety',
  },
  {
    id: 'saving',
    lesson: '4차시',
    topic: '전기 안전과 절약',
    kind: 'choice',
    question: '전기를 절약하는 방법으로 알맞은 것을 고르세요.',
    options: [
      { id: 'tv', text: '텔레비전을 켜 둔 채로 외출해요.' },
      { id: 'fridge', text: '냉장고 문을 자주 열어 두어요.' },
      { id: 'off', text: '사용하지 않는 전등은 꺼요.' },
    ],
    answer: 'off',
    explain: '쓰지 않는 전등과 전기 제품을 끄고, 사용하지 않는 플러그를 뽑으면 전기를 절약할 수 있어요.',
    mission: 'saving',
  },
  {
    id: 'magnet-only-on',
    lesson: '5~7차시',
    topic: '전자석',
    kind: 'ox',
    question: '전자석은 전기가 흐를 때만 자석의 성질이 나타난다.',
    options: OX,
    answer: 'o',
    explain: '전자석은 전기가 흐를 때만 자석이 되고, 전기가 끊기면 자석의 성질이 사라져요.',
    mission: 'magnet',
  },
  {
    id: 'magnet-stronger',
    lesson: '5~7차시',
    topic: '전자석',
    kind: 'circuit',
    question: '두 전자석은 에나멜선을 감은 횟수가 같아요. 더 센 전자석을 고르세요.',
    options: [
      { id: 'one', circuit: magnetOneBattery() },
      { id: 'two', circuit: magnetTwoBatteries() },
    ],
    answer: 'two',
    explain: '전지를 직렬로 더 많이 연결하면 전자석이 세져요. 에나멜선을 더 많이 감아도 세져요.',
    mission: 'magnet-power',
  },
  {
    id: 'magnet-pole',
    lesson: '5~7차시',
    topic: '전자석',
    kind: 'choice',
    question: '전자석의 N극과 S극을 바꾸려면 어떻게 해야 할까요?',
    options: [
      { id: 'flip', text: '전지의 방향을 반대로 바꿔요.' },
      { id: 'more', text: '전지를 하나 더 연결해요.' },
      { id: 'longer', text: '전선을 더 길게 해요.' },
    ],
    answer: 'flip',
    explain: '전지의 방향을 바꾸면 전기가 흐르는 방향이 바뀌어 전자석의 극도 바뀌어요.',
    mission: 'magnet-power',
  },
  {
    id: 'magnet-use',
    lesson: '5~7차시',
    topic: '전자석',
    kind: 'choice',
    question: '전자석을 이용한 물건이 아닌 것을 고르세요.',
    options: [
      { id: 'speaker', text: '스피커' },
      { id: 'train', text: '자기 부상 열차' },
      { id: 'compass', text: '나침반' },
    ],
    answer: 'compass',
    explain: '나침반 바늘은 영구 자석이에요. 스피커, 자기 부상 열차, 전자석 기중기는 전자석을 이용해요.',
    mission: 'magnet-power',
  },
];

/** 같은 문제를 다시 풀 때 보기 순서를 섞는다(O·X는 그대로). */
export function shuffled<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
