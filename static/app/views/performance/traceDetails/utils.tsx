import {LocationDescriptor, Query} from 'history';

import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import {Organization, OrganizationSummary} from 'sentry/types';
import {
  EventLite,
  TraceError,
  TraceFull,
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceSplitResult, reduceTrace} from 'sentry/utils/performance/quickTrace/utils';

import {DEFAULT_TRACE_ROWS_LIMIT} from './limitExceededMessage';
import {TraceInfo} from './types';

export function getTraceDetailsUrl(
  organization: OrganizationSummary,
  traceSlug: string,
  dateSelection,
  query: Query
): LocationDescriptor {
  const {start, end, statsPeriod} = dateSelection;

  const queryParams = {
    ...query,
    statsPeriod,
    [PAGE_URL_PARAM.PAGE_START]: start,
    [PAGE_URL_PARAM.PAGE_END]: end,
  };

  if (organization.features.includes('trace-view-load-more')) {
    queryParams.limit = DEFAULT_TRACE_ROWS_LIMIT;
  }

  return {
    pathname: `/organizations/${organization.slug}/performance/trace/${traceSlug}/`,
    query: queryParams,
  };
}

function transactionVisitor() {
  return (accumulator: TraceInfo, event: TraceFullDetailed) => {
    for (const error of event.errors ?? []) {
      accumulator.errors.add(error.event_id);
    }
    for (const performanceIssue of event.performance_issues ?? []) {
      accumulator.performanceIssues.add(performanceIssue.event_id);
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

export function hasTraceData(
  traces: TraceFullDetailed[] | null | undefined,
  orphanErrors: TraceError[] | undefined
): boolean {
  return Boolean(
    (traces && traces.length > 0) || (orphanErrors && orphanErrors.length > 0)
  );
}

export function getTraceSplitResults<U extends TraceFullDetailed | TraceFull | EventLite>(
  trace: TraceSplitResults<U> | U[],
  organization: Organization
) {
  let transactions: U[] | undefined;
  let orphanErrors: TraceError[] | undefined;
  if (
    trace &&
    organization.features.includes('performance-tracing-without-performance') &&
    isTraceSplitResult<TraceSplitResults<U>, U[]>(trace)
  ) {
    orphanErrors = trace.orphan_errors;
    transactions = trace.transactions;
  }

  return {transactions, orphanErrors};
}

export function getTraceInfo(
  traces: TraceFullDetailed[] = [],
  orphanErrors: TraceError[] = []
) {
  const initial = {
    projects: new Set<string>(),
    errors: new Set<string>(),
    performanceIssues: new Set<string>(),
    transactions: new Set<string>(),
    startTimestamp: Number.MAX_SAFE_INTEGER,
    endTimestamp: 0,
    maxGeneration: 0,
    trailingOrphansCount: 0,
  };

  const transactionsInfo = traces.reduce(
    (info: TraceInfo, trace: TraceFullDetailed) =>
      reduceTrace<TraceInfo>(trace, transactionVisitor(), info),
    initial
  );

  // Accumulate orphan error information.
  return orphanErrors.reduce((accumulator: TraceInfo, event: TraceError) => {
    accumulator.errors.add(event.event_id);
    accumulator.trailingOrphansCount++;

    if (event.timestamp) {
      accumulator.startTimestamp = Math.min(accumulator.startTimestamp, event.timestamp);
      accumulator.endTimestamp = Math.max(accumulator.endTimestamp, event.timestamp);
    }

    return accumulator;
  }, transactionsInfo);
}

export function shortenErrorTitle(title: string): string {
  return title.split(':')[0];
}

export function isRootTransaction(trace: TraceFullDetailed): boolean {
  // Root transactions has no parent_span_id
  return trace.parent_span_id === null;
}
