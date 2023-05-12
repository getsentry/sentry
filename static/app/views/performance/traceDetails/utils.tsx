import {LocationDescriptor, Query} from 'history';

import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {OrganizationSummary} from 'sentry/types';
import {TraceFullDetailed} from 'sentry/utils/performance/quickTrace/types';
import {reduceTrace} from 'sentry/utils/performance/quickTrace/utils';

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
      [PAGE_URL_PARAM.PAGE_START]: start,
      [PAGE_URL_PARAM.PAGE_END]: end,
    },
  };
}

function traceVisitor() {
  return (accumulator: TraceInfo, event: TraceFullDetailed) => {
    for (const error of event.errors ?? []) {
      accumulator.errors.add(error.event_id);
    }
    for (const performanceIssue of event.performance_issues ?? []) {
      accumulator.errors.add(performanceIssue.event_id);
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
    performanceIssues: new Set<string>(),
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

export function isRootTransaction(trace: TraceFullDetailed): boolean {
  // Root transactions has no parent_span_id
  return trace.parent_span_id === null;
}
