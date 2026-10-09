import {useMemo} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';

import type {Series} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {
  type IssuesSeriesResponse,
  transformIssuesResponseToSeries,
} from 'sentry/views/dashboards/datasetConfig/utils/transformIssuesResponseToSeries';
import {transformIssuesResponseToTable} from 'sentry/views/dashboards/datasetConfig/utils/transformIssuesResponseToTable';
import {DEFAULT_TABLE_LIMIT} from 'sentry/views/dashboards/types';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {
  queueApiFetch,
  useWidgetQueryQueue,
} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {combineWidgetJsonQueryResults} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineWidgetQueryResults';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_EXPAND = ['owners'];

type IssuesTableResponse = Group[];

const EMPTY_ARRAY: any[] = [];

export function useIssuesSeriesQuery(
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
        DiscoverDatasets.ISSUE_PLATFORM,
        getReferrer(filteredWidget.displayType),
        widgetInterval
      );

      requestData.queryExtras = {
        ...requestData.queryExtras,
        category: 'issue',
      };

      const {
        organization: _org,
        includeAllArgs: _includeAllArgs,
        includePrevious: _includePrevious,
        generatePathname: _generatePathname,
        dataset: _dataset,
        period,
        queryExtras,
        ...restParams
      } = requestData;

      const queryParams = {
        ...restParams,
        ...queryExtras,
        ...(period ? {statsPeriod: period} : {}),
      };

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }

      return queryOptions({
        ...apiOptions.as<IssuesSeriesResponse>()(
          '/organizations/$organizationIdOrSlug/issues-timeseries/',
          {
            path: {organizationIdOrSlug: organization.slug},
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<IssuesSeriesResponse>> => {
          return queueApiFetch<IssuesSeriesResponse>(queue, context);
        },
        enabled,
        retry: false,
        retryDelay: getRetryDelay,
        select: selectJsonWithHeaders,
        placeholderData: keepPreviousData,
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

    const timeseriesResults: Series[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;

      const transformedResult = transformIssuesResponseToSeries(responseData);
      const seriesQueryPrefix = getSeriesQueryPrefix(
        filteredWidget.queries[requestIndex]!,
        filteredWidget
      );

      transformedResult.forEach((result: Series, resultIndex: number) => {
        if (seriesQueryPrefix) {
          result.seriesName = `${seriesQueryPrefix}${SERIES_QUERY_DELIMITER}${result.seriesName}`;
        }
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

export function useIssuesTableQuery(
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
      const queryParams: Record<string, unknown> = {
        project: pageFilters.projects ?? [],
        environment: pageFilters.environments ?? [],
        query: query.conditions,
        sort: query.orderby || DEFAULT_SORT,
        expand: DEFAULT_EXPAND,
        limit: limit ?? DEFAULT_TABLE_LIMIT,
        cursor,
      };
      if (pageFilters.datetime.period) {
        queryParams.statsPeriod = pageFilters.datetime.period;
      }
      if (pageFilters.datetime.end) {
        queryParams.end = getUtcDateString(pageFilters.datetime.end);
      }
      if (pageFilters.datetime.start) {
        queryParams.start = getUtcDateString(pageFilters.datetime.start);
      }
      if (pageFilters.datetime.utc) {
        queryParams.utc = pageFilters.datetime.utc;
      }

      return queryOptions({
        ...apiOptions.as<IssuesTableResponse>()(
          '/organizations/$organizationIdOrSlug/issues/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            data: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<IssuesTableResponse>> => {
          return queueApiFetch<IssuesTableResponse>(queue, context);
        },
        enabled,
        retry: false,
        retryDelay: getRetryDelay,
        select: selectJsonWithHeaders,
      });
    }),
    combine: combineWidgetJsonQueryResults,
  });

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

  const tableResults: any[] = [];
  let responsePageLinks: string | undefined;

  queryResults.forEach((q, i) => {
    if (!q?.data?.json) {
      return;
    }

    const widgetQuery = filteredWidget.queries[i];
    if (!widgetQuery) {
      return;
    }

    const responseData = q.data.json;

    const transformedDataItem = {
      ...transformIssuesResponseToTable(
        responseData,
        widgetQuery,
        organization,
        pageFilters
      ),
      title: widgetQuery.name ?? '',
    };

    tableResults.push(transformedDataItem);

    responsePageLinks = q.data.headers.Link;
  });

  return {
    loading: false,
    errorMessage: undefined,
    tableResults,
    pageLinks: responsePageLinks,
    rawData,
  };
}
