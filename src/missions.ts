import { Arrangement, arrangement, litBulbs } from './engine/analysis';
import { Solution } from './engine/solver';
import { Circuit, PartKind } from './engine/types';

export interface Observed {
  /** 직렬 회로에서 전구를 빼 보았는지 */
  removedInSeries?: boolean;
  /** 병렬 회로에서 전구를 빼 보았는지 */
  removedInParallel?: boolean;
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
}

/**
 * 6학년 「전기의 이용」 단원 미션.
 * 교과서(비상교육) 차시 순서에 맞게 바꾸려면 이 배열의 순서와 문구만 고치면 된다.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'light',
    title: '불을 켜라!',
    goal: '전지, 전선, 전구를 연결하여 전구에 불이 켜지는 조건을 찾을 수 있다.',
    steps: ['부품 상자에서 전지, 전구, 전선을 꺼내요.', '전선의 끝을 부품의 끝에 가져다 대면 착 붙어요.', '전구에 불이 켜지도록 연결해 보세요.'],
    parts: { battery: 1, bulb: 1 },
    check: ({ circuit, sol }) => litBulbs(circuit, sol).length > 0,
    success:
      '전지의 (+)극 → 전구 → 전지의 (−)극까지 끊어지지 않고 이어져야 전구에 불이 켜져요. 이렇게 전기가 흐르는 길을 「전기 회로」라고 해요.',
  },
  {
    id: 'switch',
    title: '스위치로 켜고 끄기',
    goal: '스위치를 사용하여 전기 회로를 이었다 끊었다 할 수 있다.',
    steps: ['전지, 전구, 스위치를 연결해 회로를 만들어요.', '스위치를 눌러 닫으면 불이 켜지는지 확인해요.'],
    parts: { battery: 1, bulb: 1, switch: 1 },
    check: ({ circuit, sol }) =>
      litBulbs(circuit, sol).length > 0 &&
      circuit.parts.some((p) => p.kind === 'switch' && p.closed && Math.abs(sol.current[p.id]) > 0.01),
    success: '스위치를 닫으면 전기가 흐르는 길이 이어지고, 열면 길이 끊겨요. 그래서 스위치로 전구를 켜고 끌 수 있어요.',
  },
  {
    id: 'series',
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
    success: '전구를 한 줄로 연결하는 것을 「전구의 직렬연결」이라고 해요. 직렬연결한 전구는 전구 1개일 때보다 어두워요.',
    showBrightness: true,
  },
  {
    id: 'parallel',
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
      '전구를 여러 갈래로 나누어 연결하는 것을 「전구의 병렬연결」이라고 해요. 병렬연결한 전구는 전구 1개일 때와 밝기가 비슷하고, 직렬연결보다 밝아요.',
    showBrightness: true,
  },
  {
    id: 'remove',
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
      '직렬연결은 전기가 흐르는 길이 하나라서 전구 하나를 빼면 길이 끊겨 모두 꺼져요. 병렬연결은 길이 여러 갈래라서 하나를 빼도 나머지 전구는 켜져 있어요. 우리 집 전등이 병렬연결인 까닭이에요.',
  },
  {
    id: 'safety',
    title: '안전 탐정',
    goal: '전기를 안전하게 사용하는 방법을 말할 수 있다.',
    steps: ['이 회로에는 위험한 곳이 있어요. 전구에 불도 켜지지 않아요.', '위험한 곳을 찾아 고치고, 전구에 불을 켜 보세요.'],
    parts: { battery: 1, bulb: 1 },
    preset: safetyPreset,
    check: ({ circuit, sol }) => !sol.short && litBulbs(circuit, sol).length > 0,
    success:
      '전지의 두 극을 전선으로 바로 이으면(합선) 큰 전기가 흘러 전선이 뜨거워지고 불이 날 수도 있어요. 콘센트에 쇠붙이를 넣거나 젖은 손으로 전기 제품을 만지지 않아요.',
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

export { arrangement };
