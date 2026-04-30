import {useMemo, useRef} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';

import type {Series} from 'sentry/types/echarts';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {toArray} from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

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
    enabled,
    samplingMode,
    dashboardFilters,
    skipDashboardFilterParens,
    widgetInterval,
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<TraceMetricsSeriesResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const queryResults = useQueries({
    queries: filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.TRACEMETRICS,
        getReferrer(filteredWidget.displayType),
        widgetInterval
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

      return queryOptions({
        ...apiOptions.as<TraceMetricsSeriesResponse>()(
          '/organizations/$organizationIdOrSlug/events-timeseries/',
          {
            path: {organizationIdOrSlug: organization.slug},
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<TraceMetricsSeriesResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<TraceMetricsSeriesResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<TraceMetricsSeriesResponse>(context);
        },
        enabled,
        retry: hasQueueFeature
          ? false
          : (failureCount, error) => {
              return (
                error instanceof RequestError && error.status === 429 && failureCount < 10
              );
            },
        retryDelay: getRetryDelay,
        placeholderData: keepPreviousData,
      });
    }),
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
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};
    const rawData: TraceMetricsSeriesResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;
      rawData[requestIndex] = responseData;

      const transformedResult = TraceMetricsConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );
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

    let finalRawData = rawData;
    if (prevRawDataRef.current?.length === rawData.length) {
      const allSame = rawData.every((data, i) => data === prevRawDataRef.current?.[i]);
      if (allSame) {
        finalRawData = prevRawDataRef.current;
      }
    }

    if (finalRawData !== prevRawDataRef.current) {
      prevRawDataRef.current = finalRawData;
    }

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      timeseriesResultsTypes,
      timeseriesResultsUnits,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}

export function useTraceMetricsTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    samplingMode,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<TraceMetricsTableResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const queryResults = useQueries({
    queries: filteredWidget.queries.map(query => {
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

      return queryOptions({
        ...apiOptions.as<TraceMetricsTableResponse>()(
          '/organizations/$organizationIdOrSlug/events/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<TraceMetricsTableResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<TraceMetricsTableResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<TraceMetricsTableResponse>(context);
        },
        enabled,
        retry: hasQueueFeature
          ? false
          : (failureCount, error) => {
              return (
                error instanceof RequestError && error.status === 429 && failureCount < 10
              );
            },
        retryDelay: getRetryDelay,
        select: selectJsonWithHeaders,
      });
    }),
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

    const tableResults: any[] = [];
    const rawData: TraceMetricsTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;
      rawData[i] = responseData;

      const transformedDataItem = {
        ...TraceMetricsConfig.transformTable(
          responseData,
          filteredWidget.queries[i]!,
          organization,
          pageFilters
        ),
        title: filteredWidget.queries[i]?.name ?? '',
      };

      tableResults.push(transformedDataItem);

      responsePageLinks = q.data.headers.Link;
    });

    // Check if rawData is the same as before to prevent unnecessary rerenders
    let finalRawData = rawData;
    if (prevRawDataRef.current?.length === rawData.length) {
      const allSame = rawData.every((data, i) => data === prevRawDataRef.current?.[i]);
      if (allSame) {
        finalRawData = prevRawDataRef.current;
      }
    }

    // Store current rawData for next comparison
    if (finalRawData !== prevRawDataRef.current) {
      prevRawDataRef.current = finalRawData;
    }

    return {
      loading: false,
      errorMessage: undefined,
      tableResults,
      pageLinks: responsePageLinks,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}
