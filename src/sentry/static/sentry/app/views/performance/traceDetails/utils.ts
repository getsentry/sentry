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
  return (accumulator: TraceInfo, event: TraceFull) => {
    for (const error of event.errors ?? []) {
      accumulator.errors.add(error.project_slug);
      accumulator.relevantProjectsWithErrors.add(error.project_slug);
    }

    accumulator.transactions.add(event.event_id);
    accumulator.relevantProjectsWithTransactions.add(event.project_slug);

    accumulator.startTimestamp = Math.min(
      accumulator.startTimestamp,
      event.start_timestamp
    );
    accumulator.endTimestamp = Math.max(accumulator.endTimestamp, event.timestamp);

    accumulator.maxGeneration = Math.max(accumulator.maxGeneration, event.generation);

    return accumulator;
  };
}

export function getTraceInfo(trace: TraceFull) {
  return reduceTrace<TraceInfo>(trace, traceVisitor(), {
    relevantProjectsWithErrors: new Set<string>(),
    relevantProjectsWithTransactions: new Set<string>(),
    errors: new Set<string>(),
    transactions: new Set<string>(),
    startTimestamp: Number.MAX_SAFE_INTEGER,
    endTimestamp: 0,
    maxGeneration: 0,
  });
}

export {getDurationDisplay} from 'app/components/events/interfaces/spans/spanBar';

export {getHumanDuration, toPercent} from 'app/components/events/interfaces/spans/utils';
