import type {Theme} from '@emotion/react';

import type {EventTag, Measurement} from 'sentry/types/event';
import type {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

/**
 * `EventLite` represents the type of a simplified event from
 * the `events-trace` and `events-trace-light` endpoints.
 */
export type EventLite = {
  event_id: string;
  generation: number | null;
  parent_event_id: string | null;
  parent_span_id: string | null;
  performance_issues: TracePerformanceIssue[];
  project_id: number;
  project_slug: string;
  span_id: string;
  timestamp: number;
  transaction: string;
  'transaction.duration': number;
};

export type TraceError = {
  event_id: string;
  issue: string;
  issue_id: number;
  level: keyof Theme['level'];
  message: string;
  project_id: number;
  project_slug: string;
  span: string;
  title: string;
  event_type?: string;
  generation?: number;
  timestamp?: number;
  type?: number;
};

export type TracePerformanceIssue = Omit<TraceError, 'issue' | 'span'> & {
  culprit: string;
  end: number;
  span: string[];
  start: number;
  suspect_spans: string[];
  type: number;
  issue_short_id?: string;
};
export type TraceErrorOrIssue = TracePerformanceIssue | TraceError;

export type TraceLite = EventLite[];

export type QuickTraceEvent = EventLite & {
  errors?: TraceError[];
};

/**
 * The `events-trace` endpoint returns a tree structure that gives
 * the parent-child relationships between events.
 *
 * This is the type returned with `detailed=0`
 */
export type TraceFull = Omit<QuickTraceEvent, 'generation' | 'errors'> & {
  /**
   * In the full trace, generation, children and errors are always defined.
   */
  children: TraceFull[];
  errors: TraceError[];
  generation: number;
};

/**
 * The `events-trace` endpoint has a parameter to get
 * additional information by setting `detailed=1`.
 */
export type TraceFullDetailed = Omit<TraceFull, 'children'> & {
  children: TraceTree.Transaction[];
  sdk_name: string;
  start_timestamp: number;
  timestamp: number;
  'transaction.op': string;
  'transaction.status': string;
  measurements?: Record<string, Measurement>;
  profile_id?: string;
  tags?: EventTag[];
  transaction?: string;
};

export type TraceSplitResults<U extends TraceFull | TraceFullDetailed | EventLite> = {
  orphan_errors: TraceError[];
  transactions: U[];
};

export type TraceProps = {
  traceId: string;
  end?: string;
  start?: string;
  statsPeriod?: string | null;
};

export type TraceRequestProps = DiscoverQueryProps & TraceProps;

export type EmptyQuickTrace = {
  trace: QuickTraceEvent[];
  type: 'empty' | 'missing';
  orphanErrors?: TraceError[];
};

export type PartialQuickTrace = {
  trace: QuickTraceEvent[] | null;
  type: 'partial';
  orphanErrors?: TraceError[];
};

export type FullQuickTrace = {
  trace: QuickTraceEvent[] | null;
  type: 'full';
  orphanErrors?: TraceError[];
};

export type BaseTraceChildrenProps = Omit<
  GenericChildrenProps<TraceProps>,
  'tableData' | 'pageLinks'
>;

export type QuickTrace = EmptyQuickTrace | PartialQuickTrace | FullQuickTrace;

export type QuickTraceQueryChildrenProps = BaseTraceChildrenProps &
  QuickTrace & {
    currentEvent: QuickTraceEvent | TraceError | null;
  };

export type TraceMeta = {
  errors: number;
  performance_issues: number;
  projects: number;
  span_count: number;
  span_count_map: Record<string, number>;
  transaction_child_count_map: Record<string, number>;
  transactions: number;
};
