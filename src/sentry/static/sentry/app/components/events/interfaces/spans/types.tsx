export type SpanType = {
  trace_id: string;
  parent_span_id?: string;
  span_id: string;
  start_timestamp: number;
  timestamp: number; // this is essentially end_timestamp
  same_process_as_parent: boolean;
  op?: string;
  description?: string;
  data: Object;
};

export type SpanEntry = {
  type: 'spans';
  data: SpanType[];
};

export type SentryEvent = {
  entries: SpanEntry[];
};
