export type SpanType = {
  trace_id: string;
  parent_span_id?: string;
  span_id: string;
  start_timestamp: number;
  timestamp: number; // this is essentially end_timestamp
  same_process_as_parent?: boolean;
  op?: string;
  description?: string;
  data: Object;
};

export type SpanEntry = {
  type: 'spans';
  data: Array<SpanType>;
};

export type SentryEvent = {
  entries: Array<SpanEntry>;
  startTimestamp: number;
  endTimestamp: number;
};

export type SpanChildrenLookupType = {[span_id: string]: Array<SpanType>};

export type ParsedTraceType = {
  lookup: SpanChildrenLookupType;
  traceID: string;
  rootSpanID: string;
  traceStartTimestamp: number;
  traceEndTimestamp: number;
  numOfSpans: number;
};

export enum TickAlignment {
  Left,
  Right,
  Center,
}
