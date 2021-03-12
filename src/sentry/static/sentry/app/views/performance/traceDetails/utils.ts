import {LocationDescriptor, Query} from 'history';

import {OrganizationSummary} from 'app/types';
import {TraceFull} from 'app/utils/performance/quickTrace/types';
import {reduceTrace} from 'app/utils/performance/quickTrace/utils';

import {TraceInfo} from './types';

export function getTraceDetailsUrl(
  organization: OrganizationSummary,
  traceSlug: string,
  start: string,
  end: string,
  query: Query
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: {...query, start, end},
  };
}

function traceVisitor() {
  const errorProjectSlugs = new Set();
  const errorIds = new Set();
  const transactionProjectSlugs = new Set();
  const transactionIds = new Set();

  return (accumulator: TraceInfo, event: TraceFull) => {
    for (const error of event.errors ?? []) {
      if (!errorProjectSlugs.has(error.project_slug)) {
        errorProjectSlugs.add(error.project_slug);

        // No user conditions yet, so all projects are relevant to the error.
        accumulator.relevantProjectsWithErrors += 1;
      }

      if (!errorIds.has(error.event_id)) {
        errorIds.add(event.event_id);
        accumulator.totalErrors += 1;

        // No user conditions yet, so all errors are relevant.
        accumulator.relevantErrors += 1;
      }
    }

    if (!transactionProjectSlugs.has(event.project_slug)) {
      transactionProjectSlugs.add(event.project_slug);

      // No user conditions yet, so all projects are relevant to the transaction.
      accumulator.relevantProjectsWithTransactions += 1;
    }

    if (!transactionIds.has(event.event_id)) {
      transactionIds.add(event.event_id);
      accumulator.totalTransactions += 1;

      // No user conditions yet, so all transactions are relevant.
      accumulator.relevantTransactions += 1;
    }

    if (accumulator.startTimestamp > event.start_timestamp) {
      accumulator.startTimestamp = event.start_timestamp;
    }

    if (accumulator.endTimestamp < event.timestamp) {
      accumulator.endTimestamp = event.timestamp;
    }

    if (accumulator.maxGeneration < event.generation) {
      accumulator.maxGeneration = event.generation;
    }

    return accumulator;
  };
}

export function getTraceInfo(trace: TraceFull) {
  return reduceTrace<TraceInfo>(trace, traceVisitor(), {
    relevantProjectsWithErrors: 0,
    relevantProjectsWithTransactions: 0,
    totalErrors: 0,
    relevantErrors: 0,
    totalTransactions: 0,
    relevantTransactions: 0,
    startTimestamp: Number.MAX_SAFE_INTEGER,
    endTimestamp: 0,
    maxGeneration: 0,
  });
}

export {getDurationDisplay} from 'app/components/events/interfaces/spans/spanBar';

export {getHumanDuration, toPercent} from 'app/components/events/interfaces/spans/utils';
