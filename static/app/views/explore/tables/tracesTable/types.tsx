export type SpanResult<F extends string> = Record<F, any>;

export interface SpanResults<F extends string> {
  data: Array<SpanResult<F>>;
  meta: any;
}
