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
  tags?: {[key: string]: string};
};

export type SpanEntry = {
  type: 'spans';
  data: Array<SpanType>;
};

export type SentryTransactionEvent = {
  entries: Array<SpanEntry>;
  startTimestamp: number;
  endTimestamp: number;
};

export type SpanChildrenLookupType = {[span_id: string]: Array<SpanType>};

export type ParsedTraceType = {
  op: string;
  childSpans: SpanChildrenLookupType;
  traceID: string;
  rootSpanID: string;
  parentSpanID?: string;
  traceStartTimestamp: number;
  traceEndTimestamp: number;
  numOfSpans: number;
  spans: SpanType[];
};

export enum TickAlignment {
  Left,
  Right,
  Center,
}
