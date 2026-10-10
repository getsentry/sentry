import {useMemo} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';

import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {toArray} from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
import {
  getSeriesRequestData,
  convertEventStatsRequestDataToEventTimeseriesQueryParams,
} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {shouldUseEventsTimeseries} from 'sentry/views/dashboards/utils/shouldUseEventsTimeseries';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  combineWidgetJsonQueryResults,
  combineWidgetQueryResults,
} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineWidgetQueryResults';
import {getSeriesConfidenceInformation} from 'sentry/views/dashboards/widgetCard/hooks/utils/getSeriesConfidenceInformation';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getTimeseriesWidgetQueryOptions} from 'sentry/views/dashboards/widgetCard/hooks/utils/getTimeseriesWidgetQueryOptions';
import {useEventsTimeseriesSpotCheck} from 'sentry/views/dashboards/widgetCard/hooks/utils/useEventsTimeseriesSpotCheck';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

type LogsSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats
  | EventsTimeSeriesResponse;
type LogsTableResponse = TableData | EventsTableData;

const EMPTY_ARRAY: any[] = [];

export function useLogsSeriesQuery(
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
  const isEventsTimeseriesEnabled = shouldUseEventsTimeseries(organization);

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const seriesRequestData = filteredWidget.queries.map((_, queryIndex) => {
    const requestData = getSeriesRequestData(
      filteredWidget,
      queryIndex,
      organization,
      pageFilters,
      DiscoverDatasets.OURLOGS,
      getReferrer(filteredWidget.displayType),
      widgetInterval
    );

    if (samplingMode) {
      requestData.sampling = samplingMode;
    }
    return requestData;
  });

  const {results: queryResults, data: rawData} = useQueries({
    queries: seriesRequestData.map(requestData => {
      if (!isEventsTimeseriesEnabled) {
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
          ...apiOptions.as<LogsSeriesResponse>()(
            '/organizations/$organizationIdOrSlug/events-stats/',
            {
              path: {organizationIdOrSlug: organization.slug},
              method: 'GET' as const,
              query: queryParams,
              staleTime: getWidgetStaleTime(pageFilters),
            }
          ),
          queryFn: (context): Promise<ApiResponse<LogsSeriesResponse>> => {
            if (queue) {
              return new Promise((resolve, reject) => {
                const fetchFnRef = {
                  current: () =>
                    apiFetch<LogsSeriesResponse>(context).then(resolve, reject),
                };
                queue.addItem({fetchDataRef: fetchFnRef});
              });
            }
            return apiFetch<LogsSeriesResponse>(context);
          },
          enabled,
          retry: false,
          retryDelay: getRetryDelay,
          placeholderData: keepPreviousData,
        });
      }

      return getTimeseriesWidgetQueryOptions({
        organization,
        pageFilters,
        queue,
        enabled,
        query: convertEventStatsRequestDataToEventTimeseriesQueryParams(requestData),
      });
    }),
    combine: combineWidgetQueryResults,
  });

  useEventsTimeseriesSpotCheck({
    config: LogsConfig,
    enabled,
    statsQueryResults: queryResults,
    organization,
    pageFilters,
    widget: filteredWidget,
    timeSeriesQueries: seriesRequestData.map((requestData, queryIndex) => ({
      params: convertEventStatsRequestDataToEventTimeseriesQueryParams(requestData),
      widgetQuery: filteredWidget.queries[queryIndex]!,
    })),
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

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;

      const transformedResult = LogsConfig.transformSeries!(
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

      const resultTypes = LogsConfig.getSeriesResultType?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );
      const resultUnits = LogsConfig.getSeriesResultUnit?.(
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
  })();

  // When a widget has several queries, the last response's confidence is shown
  const confidenceInformation = useMemo(() => {
    const lastResponse = rawData.findLast(defined);
    return lastResponse
      ? getSeriesConfidenceInformation(lastResponse, widget.queries[0])
      : undefined;
  }, [rawData, widget.queries]);

  return {...transformedData, ...confidenceInformation};
}

export function useLogsTableQuery(
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

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  // Check if organization has the async queue feature
  const {results: queryResults, data: rawData} = useQueries({
    queries: filteredWidget.queries.map(query => {
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

      return queryOptions({
        ...apiOptions.as<LogsTableResponse>()(
          '/organizations/$organizationIdOrSlug/events/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<LogsTableResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () => apiFetch<LogsTableResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<LogsTableResponse>(context);
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
