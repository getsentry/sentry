export const ROW_HEIGHT = 24;
export const ROW_PADDING = 4;

export enum SpanBarHatch {
  'gap',
  'affected',
}

export const SPAN_HATCH_TYPE_COLOURS: Record<
  SpanBarHatch,
  {alternate: string; primary: string}
> = {
  [SpanBarHatch.gap]: {primary: '#dedae3', alternate: '#f4f2f7'},
  [SpanBarHatch.affected]: {primary: '#dedae3', alternate: '#f4f2f7'},
};
