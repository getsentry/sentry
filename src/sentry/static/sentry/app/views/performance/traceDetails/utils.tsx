import {LocationDescriptor, Query} from 'history';

import {OrganizationSummary} from 'app/types';
import {TraceFullDetailed} from 'app/utils/performance/quickTrace/types';
import {reduceTrace} from 'app/utils/performance/quickTrace/utils';

import {TraceInfo} from './types';

export function getTraceDetailsUrl(
  organization: OrganizationSummary,
  traceSlug: string,
  dateSelection,
  query: Query
): LocationDescriptor {
  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: {...query, ...dateSelection},
  };
}

function traceVisitor(isRelevant: (transaction: TraceFullDetailed) => boolean) {
  return (accumulator: TraceInfo, event: TraceFullDetailed) => {
    const relevant = isRelevant(event);

    for (const error of event.errors ?? []) {
      accumulator.errors.add(error.event_id);
      if (relevant) {
        accumulator.relevantErrors.add(error.event_id);
        accumulator.relevantProjectsWithErrors.add(error.project_slug);
      }
    }

    accumulator.transactions.add(event.event_id);
    if (relevant) {
      accumulator.relevantTransactions.add(event.event_id);
      accumulator.relevantProjectsWithTransactions.add(event.project_slug);
    }

    accumulator.startTimestamp = Math.min(
      accumulator.startTimestamp,
      event.start_timestamp
    );
    accumulator.endTimestamp = Math.max(accumulator.endTimestamp, event.timestamp);

    accumulator.maxGeneration = Math.max(accumulator.maxGeneration, event.generation);

    return accumulator;
  };
}

export function getTraceInfo(
  trace: TraceFullDetailed,
  isRelevant: (transaction: TraceFullDetailed) => boolean
) {
  return reduceTrace<TraceInfo>(trace, traceVisitor(isRelevant), {
    relevantProjectsWithErrors: new Set<string>(),
    relevantProjectsWithTransactions: new Set<string>(),
    relevantErrors: new Set<string>(),
    relevantTransactions: new Set<string>(),
    errors: new Set<string>(),
    transactions: new Set<string>(),
    startTimestamp: Number.MAX_SAFE_INTEGER,
    endTimestamp: 0,
    maxGeneration: 0,
  });
}

export {getDurationDisplay} from 'app/components/events/interfaces/spans/spanBar';

export {getHumanDuration, toPercent} from 'app/components/events/interfaces/spans/utils';
