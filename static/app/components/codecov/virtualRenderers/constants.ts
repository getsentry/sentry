export const LINE_HEIGHT = 16;

export type CoverageValue = 'H' | 'M' | 'P';

export type CoverageMap = Map<number, {coverage: CoverageValue; line: number}>;
