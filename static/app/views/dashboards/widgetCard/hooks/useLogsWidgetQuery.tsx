import {useCallback, useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import toArray from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueries} from 'sentry/utils/queryClient';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {combineQueryResults} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineQueryResults';

type LogsSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats;
type LogsTableResponse = TableData | EventsTableData;

const EMPTY_ARRAY: any[] = [];

export function useLogsSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true,
    samplingMode,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const queryKeys = useMemo(() => {
    const keys = filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.OURLOGS,
        getReferrer(filteredWidget.displayType)
      );

      if (samplingMode) {
        requestData.sampling = samplingMode;
      }

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
      };

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }

      return [
        `/organizations/${organization.slug}/events-stats/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ] satisfies ApiQueryKey;
    });
    return keys;
  }, [filteredWidget, organization, pageFilters, samplingMode]);

  const createQueryFn = useCallback(
    () =>
      async (context: any): Promise<ApiResult<LogsSeriesResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<LogsSeriesResponse>(context).then(resolve, reject),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        return fetchDataQuery<LogsSeriesResponse>(context);
      },
    [queue]
  );

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const {isFetching, allHaveData, errorMessage, queryData} = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFn(),
      staleTime: 0,
      enabled,
      retry: hasQueueFeature
        ? false
        : (failureCount: number, error: any) => {
            if (error?.status === 429 && failureCount < 10) {
              return true;
            }
            return false;
          },
      placeholderData: (previousData: unknown) => previousData,
    })),
    combine: combineQueryResults,
  });

  const transformedData = useMemo(() => {
    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: Series[] = [];
    const rawData: LogsSeriesResponse[] = [];

    queryData.forEach((data, requestIndex) => {
      if (!data?.[0]) {
        return;
      }

      const responseData = data[0];
      rawData[requestIndex] = responseData;

      const transformedResult = LogsConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

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
  }, [isFetching, allHaveData, errorMessage, queryData, filteredWidget, organization]);

  return transformedData;
}

export function useLogsTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true,
    samplingMode,
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

  const queryKeys = useMemo(() => {
    return filteredWidget.queries.map(query => {
      const eventView = eventViewFromWidget('', query, pageFilters);

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: DiscoverDatasets.OURLOGS,
      };

      if (query.orderby) {
        requestParams.sort = toArray(query.orderby);
      }

      const queryParams = {
        ...eventView.generateQueryStringObject(),
        ...requestParams,
        ...(samplingMode ? {sampling: samplingMode} : {}),
      };

      const baseQueryKey: ApiQueryKey = [
        `/organizations/${organization.slug}/events/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ];

      return baseQueryKey;
    });
  }, [filteredWidget, organization, pageFilters, samplingMode, cursor, limit]);

  const createQueryFnTable = useCallback(
    () =>
      async (context: any): Promise<ApiResult<LogsTableResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<LogsTableResponse>(context).then(resolve, reject),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }
        return fetchDataQuery<LogsTableResponse>(context);
      },
    [queue]
  );

  // Check if organization has the async queue feature
  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const {isFetching, allHaveData, errorMessage, queryData} = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFnTable(),
      staleTime: 0,
      enabled,
      // Retry on 429 status codes up to 10 times, unless queue handles it
      retry: hasQueueFeature
        ? false
        : (failureCount: number, error: any) => {
            // Retry up to 10 times on rate limit errors
            if (error?.status === 429 && failureCount < 10) {
              return true;
            }
            return false;
          },
    })),
    combine: combineQueryResults,
  });

  const transformedData = useMemo(() => {
    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    const rawData: LogsTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryData.forEach((data, i) => {
      if (!data?.[0]) {
        return;
      }

      const responseData = data[0];
      const responseMeta = data[2];
      rawData[i] = responseData;

      const transformedDataItem: TableDataWithTitle = {
        ...LogsConfig.transformTable(
          responseData,
          filteredWidget.queries[i]!,
          organization,
          pageFilters
        ),
        title: filteredWidget.queries[i]?.name ?? '',
      };

      tableResults.push(transformedDataItem);

      // Get page links from response meta
      responsePageLinks = responseMeta?.getResponseHeader('Link') ?? undefined;
    });

    return {
      loading: false,
      errorMessage: undefined,
      tableResults,
      pageLinks: responsePageLinks,
      rawData,
    };
  }, [
    isFetching,
    allHaveData,
    errorMessage,
    queryData,
    filteredWidget,
    organization,
    pageFilters,
  ]);

  return transformedData;
}
