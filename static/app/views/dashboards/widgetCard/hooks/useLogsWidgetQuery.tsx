import {useMemo} from 'react';
import {queryOptions, useQueries} from '@tanstack/react-query';

import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {toArray} from 'sentry/utils/array/toArray';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {eventsResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/eventsResponseTransforms';
import {
  getSeriesRequestData,
  convertEventStatsRequestDataToEventTimeseriesQueryParams,
} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {
  combineIngestionMeta,
  type WidgetTimeSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
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
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getTimeseriesWidgetQueryOptions} from 'sentry/views/dashboards/widgetCard/hooks/utils/getTimeseriesWidgetQueryOptions';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

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
    queries: seriesRequestData.map(requestData =>
      getTimeseriesWidgetQueryOptions({
        organization,
        pageFilters,
        queue,
        enabled,
        query: convertEventStatsRequestDataToEventTimeseriesQueryParams(requestData),
      })
    ),
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

    const timeseriesResults: WidgetTimeSeries[] = [];
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;

      const transformedResult = eventsResponseTransforms.transformTimeSeries!(
        responseData,
        filteredWidget,
        requestIndex
      );

      transformedResult.forEach((result, resultIndex) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });

      const resultTypes = eventsResponseTransforms.getSeriesResultType?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );
      const resultUnits = eventsResponseTransforms.getSeriesResultUnit?.(
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
      ingestion: combineIngestionMeta(queryResults.map(q => q?.data)),
      rawData,
    };
  })();

  return transformedData;
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
        ...eventsResponseTransforms.transformTable(
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
