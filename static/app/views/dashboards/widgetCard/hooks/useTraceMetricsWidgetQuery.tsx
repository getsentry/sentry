import {useCallback, useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import type {Series} from 'sentry/types/echarts';
import toArray from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import type {
  EventsTableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueries} from 'sentry/utils/queryClient';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {combineQueryResults} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineQueryResults';

type TraceMetricsSeriesResponse = EventsTimeSeriesResponse;
type TraceMetricsTableResponse = EventsTableData;

const EMPTY_ARRAY: any[] = [];

export function useTraceMetricsSeriesQuery(
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
        DiscoverDatasets.TRACEMETRICS,
        getReferrer(filteredWidget.displayType)
      );

      requestData.generatePathname = () =>
        `/organizations/${organization.slug}/events-timeseries/`;

      if (
        [DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(
          filteredWidget.displayType
        ) &&
        (filteredWidget.queries[0]?.columns?.length ?? 0) > 0
      ) {
        requestData.queryExtras = {
          ...requestData.queryExtras,
          groupBy: filteredWidget.queries[0]!.columns,
        };
      }

      // Remove duplicate yAxis values
      requestData.yAxis = [...new Set(requestData.yAxis)];

      // Add sampling mode if provided
      if (samplingMode) {
        requestData.sampling = samplingMode;
      }

      // Transform requestData into proper query params
      const {
        organization: _org,
        includeAllArgs: _includeAllArgs,
        includePrevious: _includePrevious,
        generatePathname: _generatePathname,
        period,
        queryExtras,
        ...restParams
      } = requestData;

      const queryParams = {
        ...restParams,
        ...(period ? {statsPeriod: period} : {}),
        ...queryExtras,
      };

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }

      // Build the API query key for events-timeseries endpoint
      return [
        `/organizations/${organization.slug}/events-timeseries/`,
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
      async (context: any): Promise<ApiResult<TraceMetricsSeriesResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<TraceMetricsSeriesResponse>(context).then(resolve, reject),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        return fetchDataQuery<TraceMetricsSeriesResponse>(context);
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
            // Retry up to 10 times on rate limit errors
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
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};
    const rawData: TraceMetricsSeriesResponse[] = [];

    queryData.forEach((data, requestIndex) => {
      if (!data?.[0]) {
        return;
      }

      const responseData = data[0];
      rawData[requestIndex] = responseData;

      const transformedResult = TraceMetricsConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });

      const resultTypes = TraceMetricsConfig.getSeriesResultType?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );
      const resultUnits = TraceMetricsConfig.getSeriesResultUnit?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );

      if (resultTypes) {
        Object.assign(timeseriesResultsTypes, resultTypes);
      }
      if (resultUnits) {
        Object.assign(timeseriesResultsUnits, resultUnits);
      }
    });

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      timeseriesResultsTypes,
      timeseriesResultsUnits,
      rawData,
    };
  }, [isFetching, allHaveData, errorMessage, queryData, filteredWidget, organization]);

  return transformedData;
}

export function useTraceMetricsTableQuery(
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
        dataset: DiscoverDatasets.TRACEMETRICS,
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
      async (context: any): Promise<ApiResult<TraceMetricsTableResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<TraceMetricsTableResponse>(context).then(resolve, reject),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }
        return fetchDataQuery<TraceMetricsTableResponse>(context);
      },
    [queue]
  );

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const {isFetching, allHaveData, errorMessage, queryData} = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFnTable(),
      staleTime: 0,
      enabled,
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
    const rawData: TraceMetricsTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryData.forEach((data, i) => {
      if (!data?.[0]) {
        return;
      }

      const responseData = data[0];
      const responseMeta = data[2];
      rawData[i] = responseData;

      const transformedDataItem: TableDataWithTitle = {
        ...TraceMetricsConfig.transformTable(
          responseData,
          filteredWidget.queries[i]!,
          organization,
          pageFilters
        ),
        title: filteredWidget.queries[i]?.name ?? '',
      };

      tableResults.push(transformedDataItem);

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
