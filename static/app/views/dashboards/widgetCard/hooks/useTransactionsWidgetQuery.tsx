import {useMemo} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';
import cloneDeep from 'lodash/cloneDeep';

import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {
  queueApiFetch,
  useWidgetQueryQueue,
} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  combineWidgetJsonQueryResults,
  combineWidgetQueryResults,
} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineWidgetQueryResults';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

type TransactionsSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats;
type TransactionsTableResponse = TableData | EventsTableData;

// Stable empty array to prevent infinite rerenders
const EMPTY_ARRAY: any[] = [];

/**
 * Hook for fetching Transactions widget series data (charts) using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useTransactionsSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    dashboardFilters,
    skipDashboardFilterParens,
    widgetInterval,
  } = params;

  const {queue} = useWidgetQueryQueue();

  // Apply dashboard filters
  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const {results: queryResults, data: rawData} = useQueries({
    queries: filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.SPANS,
        getReferrer(filteredWidget.displayType),
        widgetInterval
      );

      // Transform requestData into proper query params
      const {
        organization: _org,
        includeAllArgs: _includeAllArgs,
        includePrevious: _includePrevious,
        generatePathname: _generatePathname,
        period,
        ...restParams
      } = requestData;

      const queryParams = {
        ...restParams,
        ...(period ? {statsPeriod: period} : {}),
        excludeOther: restParams.excludeOther ? '1' : undefined,
        partial: restParams.partial ? '1' : undefined,
      };

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }

      return queryOptions({
        ...apiOptions.as<TransactionsSeriesResponse>()(
          '/organizations/$organizationIdOrSlug/events-stats/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<TransactionsSeriesResponse>> => {
          return queueApiFetch<TransactionsSeriesResponse>(queue, context);
        },
        enabled,
        retry: false,
        retryDelay: getRetryDelay,
        placeholderData: keepPreviousData,
      });
    }),
    combine: combineWidgetQueryResults,
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data);
    const errorMessage = queryResults.find(q => q?.error)?.error?.message;

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: Series[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;

      const transformedResult = TransactionsConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      // Maintain color consistency
      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });
    });

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      rawData,
    };
  })();

  return transformedData;
}

/**
 * Hook for fetching Transactions widget table data using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useTransactionsTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const {results: queryResults, data: rawData} = useQueries({
    queries: filteredWidget.queries.map(query => {
      // Clone the query to avoid mutating the original
      const modifiedQuery = cloneDeep(query);

      // To generate the target url for TRACE ID links we always include a timestamp,
      // to speed up the trace endpoint. Adding timestamp for the non-aggregate case and
      // max(timestamp) for the aggregate case as fields, to accomodate this.
      if (
        modifiedQuery.aggregates.length &&
        modifiedQuery.columns.includes('trace') &&
        !modifiedQuery.aggregates.includes('max(timestamp)') &&
        !modifiedQuery.columns.includes('timestamp')
      ) {
        modifiedQuery.aggregates.push('max(timestamp)');
      } else if (
        modifiedQuery.columns.includes('trace') &&
        !modifiedQuery.columns.includes('timestamp')
      ) {
        modifiedQuery.columns.push('timestamp');
      }

      const eventView = eventViewFromWidget('', modifiedQuery, pageFilters);

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: DiscoverDatasets.SPANS,
      };

      if (modifiedQuery.orderby) {
        requestParams.sort =
          typeof modifiedQuery.orderby === 'string'
            ? [modifiedQuery.orderby]
            : modifiedQuery.orderby;
      }

      const queryParams = {
        ...eventView.generateQueryStringObject(),
        ...requestParams,
      };

      return queryOptions({
        ...apiOptions.as<TransactionsTableResponse>()(
          '/organizations/$organizationIdOrSlug/events/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<TransactionsTableResponse>> => {
          return queueApiFetch<TransactionsTableResponse>(queue, context);
        },
        enabled,
        retry: false,
        retryDelay: getRetryDelay,
        select: selectJsonWithHeaders,
      });
    }),
    combine: combineWidgetJsonQueryResults,
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.json);
    const errorMessage = queryResults.find(q => q?.error)?.error?.message;

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;

      const transformedDataItem: TableDataWithTitle = {
        ...TransactionsConfig.transformTable(
          responseData,
          filteredWidget.queries[i]!,
          organization,
          pageFilters
        ),
        title: filteredWidget.queries[i]?.name ?? '',
      };

      tableResults.push(transformedDataItem);

      // Get page links from response meta
      responsePageLinks = q.data.headers.Link;
    });

    return {
      loading: false,
      errorMessage: undefined,
      tableResults,
      pageLinks: responsePageLinks,
      rawData,
    };
  })();

  return transformedData;
}
