import type {Location, LocationDescriptorObject} from 'history';

import {PAGE_URL_PARAM} from 'sentry/constants/pageFilters';
import type {DateString} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import type {
  EventLite,
  TraceError,
  TraceFull,
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceSplitResult, reduceTrace} from 'sentry/utils/performance/quickTrace/utils';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';

import {
  TRACE_SOURCE_TO_NON_INSIGHT_ROUTES,
  type TraceViewSources,
} from '../newTraceDetails/traceHeader/breadcrumbs';

import {DEFAULT_TRACE_ROWS_LIMIT} from './limitExceededMessage';
import type {TraceInfo} from './types';

function getBaseTraceUrl(
  organization: Organization,
  source?: TraceViewSources,
  view?: DomainView
) {
  if (view) {
    return getPerformanceBaseUrl(organization.slug, view);
  }

  const url =
    source && source in TRACE_SOURCE_TO_NON_INSIGHT_ROUTES
      ? TRACE_SOURCE_TO_NON_INSIGHT_ROUTES[source]
      : 'traces';

  const routeSuffix =
    url === 'traces' && organization.features.includes('navigation-sidebar-v2')
      ? 'explore/traces'
      : url;

  return normalizeUrl(`/organizations/${organization.slug}/${routeSuffix}`);
}

export function getTraceDetailsUrl({
  organization,
  traceSlug,
  dateSelection,
  timestamp,
  spanId,
  eventId,
  targetId,
  demo,
  location,
  source,
  view,
}: {
  // @TODO add a type for dateSelection
  dateSelection: any;
  location: Location;
  organization: Organization;
  traceSlug: string;
  demo?: string;
  eventId?: string;
  source?: TraceViewSources;
  spanId?: string;
  // targetId represents the span id of the transaction. It will replace eventId once all links
  // to trace view are updated to use spand ids of transactions instead of event ids.
  targetId?: string;
  timestamp?: string | number;
  view?: DomainView;
}): LocationDescriptorObject {
  const baseUrl = getBaseTraceUrl(organization, source, view);
  const queryParams: Record<string, string | number | undefined | DateString | string[]> =
    {
      ...location.query,
      statsPeriod: dateSelection.statsPeriod,
      [PAGE_URL_PARAM.PAGE_START]: dateSelection.start,
      [PAGE_URL_PARAM.PAGE_END]: dateSelection.end,
    };

  if (shouldForceRouteToOldView(organization, timestamp)) {
    return {
      pathname: normalizeUrl(`${baseUrl}/trace/${traceSlug}/`),
      query: queryParams,
    };
  }

  if (organization.features.includes('trace-view-v1')) {
    if (spanId) {
      const path: TraceTree.NodePath[] = [`span-${spanId}`, `txn-${targetId ?? eventId}`];
      queryParams.node = path;
    }
    return {
      pathname: normalizeUrl(`${baseUrl}/trace/${traceSlug}/`),
      query: {
        ...queryParams,
        timestamp: getTimeStampFromTableDateField(timestamp),
        eventId,
        targetId,
        demo,
        source,
      },
    };
  }

  if (organization.features.includes('trace-view-load-more')) {
    queryParams.limit = DEFAULT_TRACE_ROWS_LIMIT;
  }

  return {
    pathname: normalizeUrl(`${baseUrl}/trace/${traceSlug}/`),
    query: queryParams,
  };
}

/**
 * Single tenant, on-premise etc. users may not have span extraction enabled.
 *
 * This code can be removed at the time we're sure all STs have rolled out span extraction.
 */
export function shouldForceRouteToOldView(
  organization: Organization,
  timestamp: string | number | undefined
) {
  const usableTimestamp = getTimeStampFromTableDateField(timestamp);
  if (!usableTimestamp) {
    // Timestamps must always be provided for the new view, if it doesn't exist, fall back to the old view.
    return true;
  }

  return (
    organization.extraOptions?.traces.checkSpanExtractionDate &&
    organization.extraOptions?.traces.spansExtractionDate > usableTimestamp
  );
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
  return title.split(':')[0]!;
}

export function isRootTransaction(trace: TraceFullDetailed): boolean {
  // Root transactions has no parent_span_id
  return trace.parent_span_id === null;
}
