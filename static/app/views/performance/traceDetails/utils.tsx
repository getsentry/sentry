import type {Location, LocationDescriptorObject} from 'history';

import {PAGE_URL_PARAM} from 'sentry/components/pageFilters/constants';
import type {DateString} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  TRACE_SOURCE_TO_NON_INSIGHT_ROUTES,
  TraceViewSources,
} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';
import {getPerformanceBaseUrl} from 'sentry/views/performance/utils';

function getBaseTraceUrl(
  organization: Organization,
  source?: TraceViewSources,
  view?: DomainView
) {
  const routesMap = TRACE_SOURCE_TO_NON_INSIGHT_ROUTES;

  if (source === TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY) {
    return normalizeUrl(
      `/organizations/${organization.slug}/${
        view
          ? getTransactionSummaryBaseUrl(organization, view, true)
          : routesMap.performance_transaction_summary
      }`
    );
  }

  return normalizeUrl(
    `/organizations/${organization.slug}/${
      view
        ? getPerformanceBaseUrl(organization.slug, view, true)
        : source && source in routesMap
          ? routesMap[source]
          : routesMap.traces
    }`
  );
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
  tab,
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
  tab?: TraceLayoutTabKeys;
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

  queryParams.node = getNodePath(spanId, targetId, eventId);

  return {
    pathname: normalizeUrl(`${baseUrl}/trace/${traceSlug}/`),
    query: {
      ...queryParams,
      timestamp: getTimeStampFromTableDateField(timestamp),
      eventId,
      targetId,
      demo,
      source,
      tab,
    },
  };
}

function getNodePath(
  spanId: string | undefined,
  targetId: string | undefined,
  eventId: string | undefined
): TraceTree.NodePath[] {
  const path: TraceTree.NodePath[] = [];

  if (spanId) {
    path.push(`span-${spanId}`);

    if (targetId || eventId) {
      path.push(`txn-${targetId ?? eventId}`);
    }
  }

  return path;
}

/**
 * Single tenant, on-premise etc. users may not have span extraction enabled.
 *
 * This code can be removed at the time we're sure all STs have rolled out span extraction.
 */
function shouldForceRouteToOldView(
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
