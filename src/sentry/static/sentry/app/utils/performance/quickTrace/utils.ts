import omit from 'lodash/omit';

import {Event, EventTransaction} from 'app/types/event';
import {EventLite, TraceFull, TraceLite} from 'app/utils/performance/quickTrace/types';

export function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}

type PathNode = {
  event: TraceFull;
  path: TraceLite;
};

/**
 * The `events-full
 */
export function flattenRelevantPaths(event: Event, traceFull: TraceFull): TraceLite {
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
    if (current.event.event_id === event.id) {
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

function simplifyEvent(event: TraceFull): EventLite {
  return omit(event, 'children');
}

export function parseQuickTrace(trace: TraceLite, event: Event) {
  const current = trace.find(e => e.event_id === event.id) ?? null;
  const currentGeneration = current?.generation ?? null;

  const parent = trace.find(e => e.event_id === current?.parent_event_id) ?? null;
  const parentGeneration = parent?.generation ?? null;

  const root =
    trace.find(
      e =>
        e.event_id !== event.id && e.event_id !== parent?.event_id && e.generation === 0
    ) ?? null;
  const rootGeneration = root?.generation ?? null;

  const ancestors = trace.filter(({generation}) => {
    if (generation === null) {
      return false;
    }

    if (currentGeneration !== null && currentGeneration <= generation) {
      return false;
    }

    if (parentGeneration !== null && parentGeneration <= generation) {
      return false;
    }

    if (rootGeneration !== null && rootGeneration >= generation) {
      return false;
    }

    return true;
  });

  const children = trace.filter(e => e.parent_event_id === event.id);

  const descendants = trace.filter(({generation}) => {
    if (generation === null) {
      return false;
    }

    if (currentGeneration !== null && currentGeneration + 1 >= generation) {
      return false;
    }

    return true;
  });

  return {
    root,
    ancestors: sortTraceLite(ancestors),
    parent,
    current,
    children: sortTraceLite(children),
    descendants: sortTraceLite(descendants),
  };
}

function sortTraceLite(trace: TraceLite): TraceLite {
  return trace.sort((a, b) => b['transaction.duration'] - a['transaction.duration']);
}
