import omit from 'lodash/omit';

import {Client} from 'app/api';
import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {Event, EventTransaction} from 'app/types/event';
import EventView from 'app/utils/discover/eventView';
import {DiscoverQueryProps} from 'app/utils/discover/genericDiscoverQuery';
import {
  QuickTrace,
  QuickTraceEvent,
  TraceFull,
  TraceFullDetailed,
  TraceLite,
} from 'app/utils/performance/quickTrace/types';

export function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}

/**
 * An event can be an error or a transaction. We need to check whether the current
 * event id is in the list of errors as well
 */
function isCurrentEvent(
  event: TraceFull | QuickTraceEvent,
  currentEvent: Event
): boolean {
  if (isTransaction(currentEvent)) {
    return event.event_id === currentEvent.id;
  } else {
    return (
      event.errors !== undefined && event.errors.some(e => e.event_id === currentEvent.id)
    );
  }
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
   * `null` represents the lack of a root. It may still have a parent
   */
  root: QuickTraceEvent | null;
  /**
   * `[]` represents the lack of ancestors in a full quick trace
   * `null` represents the uncertainty of ancestors in a lite quick trace
   */
  ancestors: QuickTraceEvent[] | null;
  /**
   * `null` represents either the lack of a direct parent or the uncertainty
   * of what the parent is
   */
  parent: QuickTraceEvent | null;
  current: QuickTraceEvent;
  /**
   * `[]` represents the lack of children in a full/lite quick trace
   */
  children: QuickTraceEvent[];
  /**
   * `[]` represents the lack of descendants in a full quick trace
   * `null` represents the uncertainty of descendants in a lite quick trace
   */
  descendants: QuickTraceEvent[] | null;
};

export function parseQuickTrace(
  quickTrace: QuickTrace,
  event: Event
): ParsedQuickTrace | null {
  const {type, trace} = quickTrace;

  if (type === 'empty' || trace === null) {
    throw new Error('Current event not in quick trace!');
  }

  const isFullTrace = type === 'full';

  const current = trace.find(e => isCurrentEvent(e, event)) ?? null;
  if (current === null) {
    throw new Error('Current event not in quick trace!');
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
    // an ancestor cant be the root
    e.generation > 0 &&
    // an ancestor is the generation before the direct parent
    current.generation - 1 > e.generation;

  const ancestors: TraceLite | null = isFullTrace ? [] : null;
  const children: TraceLite = [];
  const descendants: TraceLite | null = isFullTrace ? [] : null;

  trace.forEach(e => {
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

export function beforeFetch(api: Client) {
  api.clear();
}

export function getQuickTraceRequestPayload({eventView, location}: DiscoverQueryProps) {
  return omit(eventView.getEventsAPIPayload(location), ['field', 'sort', 'per_page']);
}

export function makeEventView({
  start,
  end,
  statsPeriod,
}: {
  start?: string;
  end?: string;
  statsPeriod?: string;
}) {
  return EventView.fromSavedQuery({
    id: undefined,
    version: 2,
    name: '',
    // This field doesn't actually do anything,
    // just here to satify a constraint in EventView.
    fields: ['transaction.duration'],
    projects: [ALL_ACCESS_PROJECTS],
    query: '',
    environment: [],
    start,
    end,
    range: statsPeriod,
  });
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

export function getTraceTimeRangeFromEvent(event: Event): {start: string; end: string} {
  const start = isTransaction(event)
    ? event.startTimestamp
    : new Date(event.dateCreated).getTime() / 1000;
  const end = isTransaction(event) ? event.endTimestamp : start;
  return getTraceDateTimeRange({start, end});
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
