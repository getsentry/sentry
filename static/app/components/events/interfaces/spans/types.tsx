import type {Fuse} from 'sentry/utils/fuzzySearch';

import type SpanTreeModel from './spanTreeModel';

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
  'code.filepath'?: string;
  'code.function'?: string;
  'code.lineno'?: number;
  'code.namespace'?: string;
}

interface SpanDatabaseAttributes {
  'db.name'?: string;
  'db.operation'?: string;
  'db.system'?: string;
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
 * Extendeds the Raw type from json with a type for discriminating the union.
 */
type BaseSpanType = RawSpanType & {
  type?: undefined;
};

export const rawSpanKeys: Set<keyof RawSpanType> = new Set([
  'trace_id',
  'parent_span_id',
  'span_id',
  'start_timestamp',
  'timestamp',
  'same_process_as_parent',
  'op',
  'origin',
  'description',
  'status',
  'data',
  'tags',
  'hash',
  'exclusive_time',
]);

export type OrphanSpanType = RawSpanType & {
  type: 'orphan';
};

export type SpanType = BaseSpanType | OrphanSpanType | AggregateSpanType;

// this type includes natural spans which are part of the transaction event payload,
// and as well as pseudo-spans (e.g. gap spans)
export type ProcessedSpanType = SpanType | GapSpanType;

export type FetchEmbeddedChildrenState =
  | 'idle'
  | 'loading_embedded_transactions'
  | 'error_fetching_embedded_transactions';

type SpanGroupProps = {
  isNestedSpanGroupExpanded: boolean;
  spanNestedGrouping: EnhancedSpan[] | undefined;
  toggleNestedSpanGroup: (() => void) | undefined;
  toggleSiblingSpanGroup: ((span: SpanType) => void) | undefined;
};

type SpanSiblingGroupProps = {
  isLastSibling: boolean;
  occurrence: number;
  spanSiblingGrouping: EnhancedSpan[] | undefined;
  toggleSiblingSpanGroup: (span: SpanType, occurrence: number) => void;
};

type CommonEnhancedProcessedSpanType = {
  continuingTreeDepths: TreeDepthType[];
  fetchEmbeddedChildrenState: FetchEmbeddedChildrenState;
  isEmbeddedTransactionTimeAdjusted: boolean;
  isLastSibling: boolean;
  numOfSpanChildren: number;
  showEmbeddedChildren: boolean;
  toggleEmbeddedChildren: ((orgSlug: string, eventSlugs: string[]) => void) | undefined;
  treeDepth: number;
  groupOccurrence?: number;
  isFirstSiblingOfGroup?: boolean;
};

export type EnhancedSpan =
  | ({
      span: SpanType;
      type: 'root_span';
    } & CommonEnhancedProcessedSpanType)
  | ({
      span: SpanType;
      toggleNestedSpanGroup: (() => void) | undefined;
      toggleSiblingSpanGroup: ((span: SpanType, occurrence: number) => void) | undefined;
      type: 'span';
    } & CommonEnhancedProcessedSpanType);

// ProcessedSpanType with additional information
export type EnhancedProcessedSpanType =
  | EnhancedSpan
  | ({
      span: GapSpanType;
      type: 'gap';
    } & CommonEnhancedProcessedSpanType)
  | {
      span: SpanType;
      type: 'filtered_out';
    }
  | {
      span: SpanType;
      type: 'out_of_view';
    }
  | ({
      continuingTreeDepths: TreeDepthType[];
      span: SpanType;
      treeDepth: number;
      type: 'span_group_chain';
    } & SpanGroupProps)
  | ({
      continuingTreeDepths: TreeDepthType[];
      span: SpanType;
      treeDepth: number;
      type: 'span_group_siblings';
    } & SpanSiblingGroupProps);

// map span_id to children whose parent_span_id is equal to span_id
export type SpanChildrenLookupType = Record<string, SpanType[]>;

export type ParsedTraceType = {
  childSpans: SpanChildrenLookupType;
  op: string;
  rootSpanID: string;
  rootSpanStatus: string | undefined;
  spans: SpanType[];
  traceEndTimestamp: number;
  traceID: string;
  traceStartTimestamp: number;
  count?: number;
  description?: string;
  exclusiveTime?: number;
  frequency?: number;
  hash?: string;
  parentSpanID?: string;
  total?: number;
};

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

type SpanTreeDepth = number;

export type OrphanTreeDepth = {
  depth: number;
  type: 'orphan';
};

export type TreeDepthType = SpanTreeDepth | OrphanTreeDepth;

export type IndexedFusedSpan = {
  dataKeys: string[];
  dataValues: string[];
  indexed: string[];
  span: RawSpanType;
  tagKeys: string[];
  tagValues: string[];
};

export type FilterSpans = {
  results: Array<Fuse.FuseResult<IndexedFusedSpan>>;
  spanIDs: Set<string>;
};

export type TraceBound = {
  spanId: string;
  traceEndTimestamp: number;
  traceStartTimestamp: number;
};

export type DescendantGroup = {
  group: SpanTreeModel[];
  occurrence?: number;
};

export type TraceInfo = {
  /**
   * The very latest end timestamp in the trace.
   */
  endTimestamp: number;
  /**
   * The errors in the trace.
   */
  errors: Set<string>;
  /**
   * The maximum generation in the trace.
   */
  maxGeneration: number;
  /**
   * The performance Issues on the trace
   */
  performanceIssues: Set<string>;
  /**
   * The projects in the trace
   */
  projects: Set<string>;
  /**
   * The very earliest start timestamp in the trace.
   */
  startTimestamp: number;
  /**
   * The number of events that are not transactions,
   * appearing as its own row in the trace view
   */
  trailingOrphansCount: number;
  /**
   * The transactions in the trace.
   */
  transactions: Set<string>;
};
