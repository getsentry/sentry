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
  const {start, end, statsPeriod} = dateSelection;
  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: {
      ...query,
      statsPeriod,
      localStart: start,
      localEnd: end,
    },
  };
}

function traceVisitor() {
  return (accumulator: TraceInfo, event: TraceFullDetailed) => {
    for (const error of event.errors ?? []) {
      accumulator.errors.add(error.event_id);
    }

    accumulator.transactions.add(event.event_id);
    accumulator.projects.add(event.project_slug);

    accumulator.startTimestamp = Math.min(
      accumulator.startTimestamp,
      event.start_timestamp
    );
    accumulator.endTimestamp = Math.max(accumulator.endTimestamp, event.timestamp);

    accumulator.maxGeneration = Math.max(accumulator.maxGeneration, event.generation);

    return accumulator;
  };
}

export function getTraceInfo(traces: TraceFullDetailed[]) {
  const initial = {
    projects: new Set<string>(),
    errors: new Set<string>(),
    transactions: new Set<string>(),
    startTimestamp: Number.MAX_SAFE_INTEGER,
    endTimestamp: 0,
    maxGeneration: 0,
  };

  return traces.reduce(
    (info: TraceInfo, trace: TraceFullDetailed) =>
      reduceTrace<TraceInfo>(trace, traceVisitor(), info),
    initial
  );
}

export function isTraceFullDetailed(transaction): transaction is TraceFullDetailed {
  return Boolean((transaction as TraceFullDetailed).event_id);
}

export {getDurationDisplay} from 'app/components/events/interfaces/spans/spanBar';

export {getHumanDuration, toPercent} from 'app/components/events/interfaces/spans/utils';

export function isRootTransaction(trace: TraceFullDetailed): boolean {
  // Root transactions has no parent_span_id
  return trace.parent_span_id === null;
}
