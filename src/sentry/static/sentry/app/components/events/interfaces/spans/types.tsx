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

export type OrphanSpanType = {
  type: 'orphan';
} & RawSpanType;

export type SpanType = RawSpanType | OrphanSpanType;

// this type includes natural spans which are part of the transaction event payload,
// and as well as pseudo-spans (e.g. gap spans)
export type ProcessedSpanType = SpanType | GapSpanType;

export type SpanEntry = {
  type: 'spans';
  data: Array<RawSpanType>;
};

// map span_id to children whose parent_span_id is equal to span_id
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

export type TraceContextType = {
  op?: string;
  type?: 'trace';
  span_id?: string;
  trace_id?: string;
  parent_span_id?: string;
};
