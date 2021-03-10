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

export type TraceLite = EventLite[];

/**
 * The `events-trace` endpoint returns a tree structure that gives
 * the parent-child relationships between events.
 */
export type TraceFull = EventLite & {
  children: TraceFull[];
};

export type TraceProps = {
  eventId: string;
  traceId: string;
  start: string;
  end: string;
};

export type TraceRequestProps = DiscoverQueryProps & TraceProps;

type EmptyQuickTrace = {
  type: 'empty';
  trace: TraceLite;
};

type PartialQuickTrace = {
  type: 'partial';
  trace: TraceLite | null;
};

type FullQuickTrace = {
  type: 'full';
  trace: TraceLite | null;
};

type BaseTraceChildrenProps = Omit<
  GenericChildrenProps<TraceProps>,
  'tableData' | 'pageLinks'
>;

export type TraceLiteQueryChildrenProps = BaseTraceChildrenProps & PartialQuickTrace;

export type TraceFullQueryChildrenProps = BaseTraceChildrenProps &
  Omit<FullQuickTrace, 'trace'> & {
    /**
     * The `event-trace` endpoint returns a full trace with the parent-child
     * relationships. It can be flattened into a `TraceLite` if necessary.
     */
    trace: TraceFull | null;
  };

export type QuickTrace = EmptyQuickTrace | PartialQuickTrace | FullQuickTrace;

export type QuickTraceQueryChildrenProps = BaseTraceChildrenProps & QuickTrace;
