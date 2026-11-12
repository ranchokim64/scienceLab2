export type PartKind = 'battery' | 'bulb' | 'switch' | 'wire';

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
};

export const PART_NAME: Record<PartKind, string> = {
  battery: '전지',
  bulb: '전구',
  switch: '스위치',
  wire: '전선',
};

export const isRigid = (k: PartKind) => k !== 'wire';

export const emptyCircuit = (): Circuit => ({ vertices: {}, parts: [] });
