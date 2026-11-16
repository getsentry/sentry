export type GapSpanType = {
  isOrphan: boolean;
  start_timestamp: number;
  // this is essentially end_timestamp
  timestamp: number;
  type: 'gap';
  description?: string;
};

interface SpanSourceCodeAttributes {
  'code.column'?: number;
  'code.file.path'?: string;
  'code.function'?: string;
  'code.line.number'?: number;
  'code.namespace'?: string;
}

interface SpanDatabaseAttributes {
  'db.name'?: string;
  'db.operation'?: string;
  'db.system.name'?: string;
  'db.user'?: string;
}

export type RawSpanType = {
  span_id: string;
  start_timestamp: number;
  // this is essentially end_timestamp
  timestamp: number;
  trace_id: string;
  data?: SpanSourceCodeAttributes & SpanDatabaseAttributes & Record<string, any>;
  description?: string;
  exclusive_time?: number;
  hash?: string;
  links?: SpanLink[];
  op?: string;
  origin?: string;
  parent_span_id?: string;
  project_slug?: string;
  same_process_as_parent?: boolean;
  sentry_tags?: Record<string, string>;
  'span.averageResults'?: {
    'avg(span.duration)'?: number;
    'avg(span.self_time)'?: number;
  };
  status?: string;
  tags?: Record<string, string>;
};

export type AggregateSpanType = RawSpanType & {
  count: number;
  frequency: number;
  samples: Array<{
    span: string;
    timestamp: number;
    trace: string;
    transaction: string;
  }>;
  total: number;
  type: 'aggregate';
};

/**
 * Extends the Raw type from json with a type for discriminating the union.
 */
type BaseSpanType = RawSpanType & {
  type?: undefined;
};

type OrphanSpanType = RawSpanType & {
  type: 'orphan';
};

type SpanType = BaseSpanType | OrphanSpanType | AggregateSpanType;

// this type includes natural spans which are part of the transaction event payload,
// and as well as pseudo-spans (e.g. gap spans)
export type ProcessedSpanType = SpanType | GapSpanType;

type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

type SpanLink = {
  span_id: string;
  trace_id: string;
  attributes?: Record<string, AttributeValue> & {'sentry.link.type'?: AttributeValue};
  parent_span_id?: string;
  sampled?: boolean;
};

export type TraceContextType = {
  client_sample_rate?: number;
  count?: number;
  data?: Record<string, any>;
  description?: string;
  exclusive_time?: number;
  frequency?: number;
  hash?: string;
  links?: SpanLink[];
  op?: string;
  parent_span_id?: string;
  span_id?: string;
  status?: string;
  total?: number;
  trace_id?: string;
  type?: 'trace';
};

export type TraceContextSpanProxy = Omit<TraceContextType, 'span_id'> & {
  span_id: string; // TODO: Remove this temporary type.
};
