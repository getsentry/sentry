import {EventTag, Measurement} from 'app/types/event';
import {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';

/**
 * `EventLite` represents the type of a simplified event from
 * the `events-trace` and `events-trace-light` endpoints.
 */
export type EventLite = {
  event_id: string;
  generation: number | null;
  span_id: string;
  transaction: string;
  'transaction.duration': number;
  project_id: number;
  project_slug: string;
  parent_event_id: string | null;
  parent_span_id: string | null;
};

export type TraceError = {
  issue: string;
  event_id: string;
  span: string;
  transaction: string;
  project_id: number;
  project_slug: string;
};

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
  children: TraceFullDetailed[];
  environment: string;
  measurements?: Record<string, Measurement>;
  tags?: EventTag[];
  release: string;
  start_timestamp: number;
  timestamp: number;
  'transaction.op': string;
  'transaction.status': string;
};

export type TraceProps = {
  traceId: string;
  start?: string;
  end?: string;
  statsPeriod?: string;
};

export type TraceRequestProps = DiscoverQueryProps & TraceProps;

export type EmptyQuickTrace = {
  type: 'empty';
  trace: QuickTraceEvent[];
};

export type PartialQuickTrace = {
  type: 'partial';
  trace: QuickTraceEvent[] | null;
};

export type FullQuickTrace = {
  type: 'full';
  trace: QuickTraceEvent[] | null;
};

export type BaseTraceChildrenProps = Omit<
  GenericChildrenProps<TraceProps>,
  'tableData' | 'pageLinks'
>;

export type QuickTrace = EmptyQuickTrace | PartialQuickTrace | FullQuickTrace;

export type QuickTraceQueryChildrenProps = BaseTraceChildrenProps & QuickTrace;
