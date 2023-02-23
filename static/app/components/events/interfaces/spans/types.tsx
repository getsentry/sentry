import type {Fuse} from 'sentry/utils/fuzzySearch';

import {SpanBarProps} from './spanBar';
import {SpanDescendantGroupBarProps} from './spanDescendantGroupBar';
import {SpanSiblingGroupBarProps} from './spanSiblingGroupBar';
import SpanTreeModel from './spanTreeModel';

export type GapSpanType = {
  isOrphan: boolean;
  start_timestamp: number;
  // this is essentially end_timestamp
  timestamp: number;
  type: 'gap';
  description?: string;
};

export type RawSpanType = {
  data: Record<string, any>;
  span_id: string;
  start_timestamp: number;
  // this is essentially end_timestamp
  timestamp: number;
  trace_id: string;
  description?: string;
  exclusive_time?: number;
  hash?: string;
  op?: string;
  parent_span_id?: string;
  same_process_as_parent?: boolean;
  status?: string;
  tags?: {[key: string]: string};
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
  isNestedSpanGroupExpanded: boolean;
  spanNestedGrouping: EnhancedSpan[] | undefined;
  toggleNestedSpanGroup: (() => void) | undefined;
  toggleSiblingSpanGroup: ((span: SpanType) => void) | undefined;
};

export type SpanSiblingGroupProps = {
  isLastSibling: boolean;
  occurrence: number;
  spanSiblingGrouping: EnhancedSpan[] | undefined;
  toggleSiblingSpanGroup: (span: SpanType, occurrence: number) => void;
};

type CommonEnhancedProcessedSpanType = {
  continuingTreeDepths: Array<TreeDepthType>;
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
      continuingTreeDepths: Array<TreeDepthType>;
      span: SpanType;
      treeDepth: number;
      type: 'span_group_chain';
    } & SpanGroupProps)
  | ({
      continuingTreeDepths: Array<TreeDepthType>;
      span: SpanType;
      treeDepth: number;
      type: 'span_group_siblings';
    } & SpanSiblingGroupProps);

// map span_id to children whose parent_span_id is equal to span_id
export type SpanChildrenLookupType = {[span_id: string]: Array<SpanType>};

export type ParsedTraceType = {
  childSpans: SpanChildrenLookupType;
  op: string;
  rootSpanID: string;
  rootSpanStatus: string | undefined;
  spans: SpanType[];
  traceEndTimestamp: number;
  traceID: string;
  traceStartTimestamp: number;
  description?: string;
  exclusiveTime?: number;
  hash?: string;
  parentSpanID?: string;
};

export enum TickAlignment {
  Left,
  Right,
  Center,
}

export type TraceContextType = {
  description?: string;
  exclusive_time?: number;
  hash?: string;
  op?: string;
  parent_span_id?: string;
  span_id?: string;
  status?: string;
  trace_id?: string;
  type?: 'trace';
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
  results: Fuse.FuseResult<IndexedFusedSpan>[];
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

export enum GroupType {
  DESCENDANTS,
  SIBLINGS,
}

export enum SpanTreeNodeType {
  SPAN,
  DESCENDANT_GROUP,
  SIBLING_GROUP,
  MESSAGE,
}

type SpanBarNode = {
  props: Omit<
    SpanBarProps,
    | 'measure'
    | 'didAnchoredSpanMount'
    | 'markAnchoredSpanIsMounted'
    | 'addExpandedSpan'
    | 'removeExpandedSpan'
    | 'isSpanExpanded'
    | 'cellMeasurerCache'
    | 'listRef'
  >;
  type: SpanTreeNodeType.SPAN;
};

type SpanSiblingNode = {
  props: Omit<
    SpanSiblingGroupBarProps,
    | 'measure'
    | 'didAnchoredSpanMount'
    | 'markAnchoredSpanIsMounted'
    | 'addExpandedSpan'
    | 'removeExpandedSpan'
    | 'isSpanExpanded'
  >;
  type: SpanTreeNodeType.SIBLING_GROUP;
};

type SpanDescendantNode = {
  props: Omit<
    SpanDescendantGroupBarProps,
    | 'measure'
    | 'didAnchoredSpanMount'
    | 'markAnchoredSpanIsMounted'
    | 'addExpandedSpan'
    | 'removeExpandedSpan'
    | 'isSpanExpanded'
  >;
  type: SpanTreeNodeType.DESCENDANT_GROUP;
};

type SpanMessageNode = {
  element: JSX.Element;
  type: SpanTreeNodeType.MESSAGE;
};

export type SpanTreeNode =
  | SpanBarNode
  | SpanSiblingNode
  | SpanDescendantNode
  | SpanMessageNode;
