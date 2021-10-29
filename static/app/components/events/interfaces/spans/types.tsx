export type GapSpanType = {
  type: 'gap';
  start_timestamp: number;
  timestamp: number; // this is essentially end_timestamp
  description?: string;
  isOrphan: boolean;
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
  status?: string;
  data: Object;
  tags?: {[key: string]: string};
  hash?: string;
  exclusive_time?: number;
};

export const rawSpanKeys: Set<keyof RawSpanType> = new Set([
  'trace_id',
  'parent_span_id',
  'span_id',
  'start_timestamp',
  'timestamp',
  'same_process_as_parent',
  'op',
  'description',
  'status',
  'data',
  'tags',
  'hash',
  'exclusive_time',
]);

export type OrphanSpanType = {
  type: 'orphan';
} & RawSpanType;

export type SpanType = RawSpanType | OrphanSpanType;

// this type includes natural spans which are part of the transaction event payload,
// and as well as pseudo-spans (e.g. gap spans)
export type ProcessedSpanType = SpanType | GapSpanType;

export type FetchEmbeddedChildrenState =
  | 'idle'
  | 'loading_embedded_transactions'
  | 'error_fetching_embedded_transactions';

export type SpanGroupProps = {
  spanGrouping: EnhancedSpan[] | undefined;
  showSpanGroup: boolean;
  toggleSpanGroup: (() => void) | undefined;
};

type CommonEnhancedProcessedSpanType = {
  numOfSpanChildren: number;
  treeDepth: number;
  isLastSibling: boolean;
  continuingTreeDepths: Array<TreeDepthType>;
  fetchEmbeddedChildrenState: FetchEmbeddedChildrenState;
  showEmbeddedChildren: boolean;
  toggleEmbeddedChildren:
    | ((props: {orgSlug: string; eventSlug: string}) => void)
    | undefined;
};

export type EnhancedSpan =
  | ({
      type: 'root_span';
      span: SpanType;
    } & CommonEnhancedProcessedSpanType)
  | ({
      type: 'span';
      span: SpanType;
      toggleSpanGroup: (() => void) | undefined;
    } & CommonEnhancedProcessedSpanType);

// ProcessedSpanType with additional information
export type EnhancedProcessedSpanType =
  | EnhancedSpan
  | ({
      type: 'gap';
      span: GapSpanType;
    } & CommonEnhancedProcessedSpanType)
  | {
      type: 'filtered_out';
      span: SpanType;
    }
  | {
      type: 'out_of_view';
      span: SpanType;
    }
  | ({
      type: 'span_group_chain';
      span: SpanType;
      treeDepth: number;
      continuingTreeDepths: Array<TreeDepthType>;
    } & SpanGroupProps);

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
  rootSpanStatus: string | undefined;
  parentSpanID?: string;
  traceStartTimestamp: number;
  traceEndTimestamp: number;
  spans: SpanType[];
  description?: string;
  hash?: string;
  exclusiveTime?: number;
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
  description?: string;
  status?: string;
  hash?: string;
  exclusive_time?: number;
};

type SpanTreeDepth = number;

export type OrphanTreeDepth = {
  type: 'orphan';
  depth: number;
};

export type TreeDepthType = SpanTreeDepth | OrphanTreeDepth;

export type IndexedFusedSpan = {
  span: RawSpanType;
  indexed: string[];
  tagKeys: string[];
  tagValues: string[];
  dataKeys: string[];
  dataValues: string[];
};

export type FuseResult = {
  item: IndexedFusedSpan;
  score: number;
};

export type FilterSpans = {
  results: FuseResult[];
  spanIDs: Set<string>;
};

type FuseKey = 'indexed' | 'tagKeys' | 'tagValues' | 'dataKeys' | 'dataValues';

export type SpanFuseOptions = {
  keys: FuseKey[];
  includeMatches: false;
  threshold: number;
  location: number;
  distance: number;
  maxPatternLength: number;
};

export type TraceBound = {
  spanId: string;
  traceStartTimestamp: number;
  traceEndTimestamp: number;
};
