export type GapSpanType = {
  type: 'gap';
  start_timestamp: number;
  timestamp: number; // this is essentially end_timestamp
  description?: string;
};

export type RawSpanType = {
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

export type ProcessedSpanType = RawSpanType | GapSpanType;

export type SpanEntry = {
  type: 'spans';
  data: Array<RawSpanType>;
};

export type SpanChildrenLookupType = {[span_id: string]: Array<RawSpanType>};

export type ParsedTraceType = {
  op: string;
  childSpans: SpanChildrenLookupType;
  traceID: string;
  rootSpanID: string;
  parentSpanID?: string;
  traceStartTimestamp: number;
  traceEndTimestamp: number;
  numOfSpans: number;
  spans: RawSpanType[];
};

export enum TickAlignment {
  Left,
  Right,
  Center,
}

export type TraceContextType = {
  op?: string;
  type?: 'trace';
  span_id?: string;
  trace_id?: string;
  parent_span_id?: string;
};
