import {keepPreviousData, queryOptions} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {convertEventStatsRequestDataToEventTimeseriesQueryParams} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {
  queueApiFetch,
  type useWidgetQueryQueue,
} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

// Shared query options for dashboard widget series requests to `/events-timeseries/`
export function getTimeseriesWidgetQueryOptions({
  organization,
  pageFilters,
  query,
  queue,
  enabled,
}: {
  enabled: boolean | undefined;
  organization: Organization;
  pageFilters: PageFilters;
  query: ReturnType<typeof convertEventStatsRequestDataToEventTimeseriesQueryParams>;
  queue: ReturnType<typeof useWidgetQueryQueue>['queue'];
}) {
  return queryOptions({
    ...apiOptions.as<EventsTimeSeriesResponse>()(
      '/organizations/$organizationIdOrSlug/events-timeseries/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query,
        staleTime: getWidgetStaleTime(pageFilters),
      }
    ),
    queryFn: (context): Promise<ApiResponse<EventsTimeSeriesResponse>> => {
      return queueApiFetch<EventsTimeSeriesResponse>(queue, context);
    },
    enabled,
    retry: false,
    retryDelay: getRetryDelay,
    placeholderData: keepPreviousData,
  });
}
