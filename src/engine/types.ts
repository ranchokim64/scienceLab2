export type PartKind = 'battery' | 'bulb' | 'switch' | 'wire' | 'object' | 'coil';

/** 전기가 통하는지 검사할 물체 */
export type MaterialId = 'clip' | 'foil' | 'coin' | 'eraser' | 'ruler' | 'chopstick';

export const MATERIALS: Record<MaterialId, { name: string; conducts: boolean }> = {
  clip: { name: '철 클립', conducts: true },
  foil: { name: '알루미늄 포일', conducts: true },
  coin: { name: '동전', conducts: true },
  eraser: { name: '지우개', conducts: false },
  ruler: { name: '플라스틱 자', conducts: false },
  chopstick: { name: '나무젓가락', conducts: false },
};
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];

export interface Vec {
  x: number;
  y: number;
}

export interface Vertex extends Vec {
  id: string;
}

/**
 * 모든 부품은 두 개의 꼭짓점(a, b) 사이에 놓인 "변"이다.
 * 전지: a = (−)극, b = (+)극
 */
export interface Part {
  id: string;
  kind: PartKind;
  a: string;
  b: string;
  /** 스위치가 닫혀 있는지 */
  closed?: boolean;
  /** 전구가 끼우개에서 빠져 있는지 */
  removed?: boolean;
  /** 검사할 물체의 종류 */
  material?: MaterialId;
  /** 전자석 코일을 감은 정도: 1 = 적게, 2 = 많이 */
  turns?: 1 | 2;
  /** 부품 위에 붙이는 이름표 (예: 공부방) */
  label?: string;
}

export interface Circuit {
  vertices: Record<string, Vertex>;
  parts: Part[];
}

export const PART_LENGTH: Record<PartKind, number> = {
  battery: 120,
  bulb: 100,
  switch: 100,
  wire: 140,
  object: 110,
  coil: 140,
};

export const PART_NAME: Record<PartKind, string> = {
  battery: '전지',
  bulb: '전구',
  switch: '스위치',
  wire: '전선',
  object: '검사할 물체',
  coil: '전자석',
};

export const isRigid = (k: PartKind) => k !== 'wire';

export const emptyCircuit = (): Circuit => ({ vertices: {}, parts: [] });
