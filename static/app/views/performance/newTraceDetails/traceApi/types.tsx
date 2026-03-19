import type {EventTag, Level, Measurement} from 'sentry/types/event';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

/**
 * `EventLite` represents the type of a simplified event from
 * the `events-trace` and `events-trace-light` endpoints.
 */
type EventLite = {
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
  level: Level;
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

type QuickTraceEvent = EventLite & {
  errors?: TraceError[];
};

/**
 * The `events-trace` endpoint returns a tree structure that gives
 * the parent-child relationships between events.
 *
 * This is the type returned with `detailed=0`
 */
type TraceFull = Omit<QuickTraceEvent, 'generation' | 'errors'> & {
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

export type TraceMeta = {
  errors: number;
  performance_issues: number;
  projects: number;
  span_count: number;
  span_count_map: Record<string, number>;
  transaction_child_count_map: Record<string, number>;
  transactions: number;
};

export type EAPTraceMeta = {
  errors: number;
  logs: number;
  performance_issues: number;
  span_count: number;
  span_count_map: Record<string, number>;
  transaction_child_count_map: Record<string, number>;
  uptime_checks: number;
};
