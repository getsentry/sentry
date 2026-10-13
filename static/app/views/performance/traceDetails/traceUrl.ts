import type {Location, LocationDescriptorObject} from 'history';

import {PAGE_URL_PARAM} from 'sentry/components/pageFilters/constants';
import type {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {DateString} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {
  TRACE_SOURCE_TO_NON_INSIGHT_ROUTES,
  TraceViewSources,
} from 'sentry/views/performance/traceDetails/traceHeader/breadcrumbs';
import {TraceLayoutTabKeys} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';
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
  location,
  source,
  view,
  tab,
}: {
  dateSelection: ReturnType<typeof normalizeDateTimeParams>;
  location: Location;
  organization: Organization;
  traceSlug: string;
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

  if (
    normalizeUrl(location.pathname) !== normalizeUrl(`${baseUrl}/trace/${traceSlug}/`)
  ) {
    delete queryParams.pinnedAttribute;
  }

  queryParams.node = spanId ? [`span-${spanId}`] : [];

  return {
    pathname: normalizeUrl(`${baseUrl}/trace/${traceSlug}/`),
    query: {
      ...queryParams,
      timestamp: getTimeStampFromTableDateField(timestamp),
      eventId,
      targetId,
      source,
      tab,
    },
  };
}
