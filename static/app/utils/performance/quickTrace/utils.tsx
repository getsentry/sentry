import omit from 'lodash/omit';
import moment from 'moment-timezone';

import {getTraceDateTimeRange} from 'sentry/components/events/interfaces/spans/utils';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {OrganizationSummary} from 'sentry/types';
import {Event, EventTransaction} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverQueryProps} from 'sentry/utils/discover/genericDiscoverQuery';
import {
  QuickTrace,
  QuickTraceEvent,
  TraceError,
  TraceFull,
  TraceFullDetailed,
  TraceLite,
} from 'sentry/utils/performance/quickTrace/types';
import {TraceRoot} from 'sentry/views/performance/traceDetails/types';

export function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}

/**
 * An event can be an error or a transaction. We need to check whether the current
 * event id is in the list of errors as well
 */
export function isCurrentEvent(
  event: TraceFull | QuickTraceEvent,
  currentEvent: Event
): boolean {
  if (isTransaction(currentEvent)) {
    return event.event_id === currentEvent.id;
  }
  return (
    event.errors !== undefined && event.errors.some(e => e.event_id === currentEvent.id)
  );
}

type PathNode = {
  event: TraceFull;
  path: TraceLite;
};

/**
 * The `events-full` endpoint returns the full trace containing the specified event.
 * This means any sibling paths in the trace will also be returned.
 *
 * This method strips away these sibling paths leaving only the path from the root to
 * the specified event and all of its children/descendants.
 *
 * This method additionally flattens the trace into an array of the transactions in
 * the trace.
 */
export function flattenRelevantPaths(
  currentEvent: Event,
  traceFull: TraceFull
): TraceLite {
  const relevantPath: TraceLite = [];
  const events: TraceFull[] = [];

  /**
   * First find a path from the root transaction to the current transaction via
   * a breadth first search. This adds all transactions from the root to the
   * current transaction (excluding the current transaction itself), to the
   * relevant path.
   */
  const paths: PathNode[] = [{event: traceFull, path: []}];
  while (paths.length) {
    const current = paths.shift()!;
    if (isCurrentEvent(current.event, currentEvent)) {
      for (const node of current.path) {
        relevantPath.push(node);
      }
      events.push(current.event);
    } else {
      const path = [...current.path, simplifyEvent(current.event)];
      for (const child of current.event.children) {
        paths.push({event: child, path});
      }
    }
  }

  if (!events.length) {
    throw new Error('No relevant path exists!');
  }

  /**
   * Traverse all transactions from current transaction onwards and add
   * them all to the relevant path.
   */
  while (events.length) {
    const current = events.shift()!;
    for (const child of current.children) {
      events.push(child);
    }
    relevantPath.push(simplifyEvent(current));
  }

  return relevantPath;
}

function simplifyEvent(event: TraceFull): QuickTraceEvent {
  return omit(event, ['children']);
}

type ParsedQuickTrace = {
  /**
   * `[]` represents the lack of ancestors in a full trace navigator
   * `null` represents the uncertainty of ancestors in a lite trace navigator
   */
  ancestors: QuickTraceEvent[] | null;
  /**
   * `[]` represents the lack of children in a full/lite trace navigator
   */
  children: QuickTraceEvent[];
  current: QuickTraceEvent;
  /**
   * `[]` represents the lack of descendants in a full trace navigator
   * `null` represents the uncertainty of descendants in a lite trace navigator
   */
  descendants: QuickTraceEvent[] | null;
  /**
   * `null` represents either the lack of a direct parent or the uncertainty
   * of what the parent is
   */
  parent: QuickTraceEvent | null;
  /**
   * `null` represents the lack of a root. It may still have a parent
   */
  root: QuickTraceEvent | null;
};

export function parseQuickTrace(
  quickTrace: QuickTrace,
  event: Event,
  organization: OrganizationSummary
): ParsedQuickTrace | null {
  const {type, trace} = quickTrace;

  if (type === 'empty' || trace === null) {
    throw new Error('Current event not in trace navigator!');
  }

  const isFullTrace = type === 'full';

  const current = trace.find(e => isCurrentEvent(e, event)) ?? null;
  if (current === null) {
    throw new Error('Current event not in trace navigator!');
  }

  /**
   * The parent event is the direct ancestor of the current event.
   * This takes priority over the root, meaning if the parent is
   * the root of the trace, this favours showing it as the parent.
   */
  const parent = current.parent_event_id
    ? trace.find(e => e.event_id === current.parent_event_id) ?? null
    : null;

  /**
   * The root event is the first event in the trace. This has lower priority
   * than the parent event, meaning if the root event is the parent event of
   * the current event, this favours showing it as the parent event.
   */
  const root =
    trace.find(
      e =>
        // a root can't be the current event
        e.event_id !== current.event_id &&
        // a root can't be the direct parent
        e.event_id !== parent?.event_id &&
        // a root has to to be the first generation
        e.generation === 0
    ) ?? null;

  const isChildren = e => e.parent_event_id === current.event_id;

  const isDescendant = e =>
    // the current generation needs to be known to determine a descendant
    current.generation !== null &&
    // the event's generation needs to be known to determine a descendant
    e.generation !== null &&
    // a descendant is the generation after the direct children
    current.generation + 1 < e.generation;

  const isAncestor = e =>
    // the current generation needs to be known to determine an ancestor
    current.generation !== null &&
    // the event's generation needs to be known to determine an ancestor
    e.generation !== null &&
    // an ancestor can't be the root
    e.generation > 0 &&
    // an ancestor is the generation before the direct parent
    current.generation - 1 > e.generation;

  const ancestors: TraceLite | null = isFullTrace ? [] : null;
  const children: TraceLite = [];
  const descendants: TraceLite | null = isFullTrace ? [] : null;
  const projects = new Set();

  trace.forEach(e => {
    projects.add(e.project_id);
    if (isChildren(e)) {
      children.push(e);
    } else if (isFullTrace) {
      if (isAncestor(e)) {
        ancestors?.push(e);
      } else if (isDescendant(e)) {
        descendants?.push(e);
      }
    }
  });

  if (isFullTrace && projects.size > 1) {
    handleProjectMeta(organization, projects.size);
  }

  return {
    root,
    ancestors: ancestors === null ? null : sortTraceLite(ancestors),
    parent,
    current,
    children: sortTraceLite(children),
    descendants: descendants === null ? null : sortTraceLite(descendants),
  };
}

function sortTraceLite(trace: TraceLite): TraceLite {
  return trace.sort((a, b) => b['transaction.duration'] - a['transaction.duration']);
}

export function getTraceRequestPayload({
  eventView,
  location,
}: Pick<DiscoverQueryProps, 'eventView' | 'location'>) {
  return omit(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page']);
}

export function makeEventView({
  start,
  end,
  statsPeriod,
}: {
  end?: string;
  start?: string;
  statsPeriod?: string | null;
}) {
  return EventView.fromSavedQuery({
    id: undefined,
    version: 2,
    name: '',
    // This field doesn't actually do anything,
    // just here to satisfy a constraint in EventView.
    fields: ['transaction.duration'],
    projects: [ALL_ACCESS_PROJECTS],
    query: '',
    environment: [],
    start,
    end,
    range: statsPeriod ?? undefined,
  });
}

export function getTraceTimeRangeFromEvent(event: Event): {end: string; start: string} {
  const start = isTransaction(event)
    ? event.startTimestamp
    : moment(event.dateReceived ? event.dateReceived : event.dateCreated).valueOf() /
      1000;
  const end = isTransaction(event) ? event.endTimestamp : start;
  return getTraceDateTimeRange({start, end});
}

export function reduceTrace<T>(
  trace: TraceFullDetailed,
  visitor: (acc: T, e: TraceFullDetailed) => T,
  initialValue: T
): T {
  let result = initialValue;

  const events = [trace];
  while (events.length) {
    const current = events.pop()!;
    for (const child of current.children) {
      events.push(child);
    }
    result = visitor(result, current);
  }

  return result;
}

export function filterTrace(
  trace: TraceFullDetailed,
  predicate: (transaction: TraceFullDetailed) => boolean
): TraceFullDetailed[] {
  return reduceTrace<TraceFullDetailed[]>(
    trace,
    (transactions, transaction) => {
      if (predicate(transaction)) {
        transactions.push(transaction);
      }
      return transactions;
    },
    []
  );
}

export function isTraceTransaction<U extends TraceFull | TraceFullDetailed>(
  transaction: TraceRoot | TraceError | QuickTraceEvent | U
): transaction is U {
  return 'event_id' in transaction;
}

export function isTraceError(
  transaction: TraceRoot | TraceError | TraceFullDetailed | QuickTraceEvent
): transaction is TraceError {
  return 'event_type' in transaction && transaction.event_type === 'error';
}

export function isTraceRoot(
  transaction: TraceRoot | TraceError | TraceFullDetailed
): transaction is TraceRoot {
  return 'traceSlug' in transaction;
}

export function isTraceSplitResult<U extends object, V extends object>(
  result: U | V
): result is U {
  return 'transactions' in result;
}

function handleProjectMeta(organization: OrganizationSummary, projects: number) {
  trackAnalytics('quick_trace.connected_services', {
    organization: organization.id,
    projects,
  });
}
