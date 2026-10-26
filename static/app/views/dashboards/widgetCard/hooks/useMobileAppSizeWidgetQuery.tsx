import {useMemo} from 'react';
import {useQueries} from '@tanstack/react-query';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {
  getSeriesRequestData,
  convertEventStatsRequestDataToEventTimeseriesQueryParams,
} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {mobileAppSizeResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/mobileAppSizeResponseTransforms';
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
import {combineWidgetQueryResults} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineWidgetQueryResults';
import {getTimeseriesWidgetQueryOptions} from 'sentry/views/dashboards/widgetCard/hooks/utils/getTimeseriesWidgetQueryOptions';

const EMPTY_ARRAY: any[] = [];

/**
 * Hook for fetching MobileAppSize widget series data (charts) using React Query.
 */
export function useMobileAppSizeSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    dashboardFilters,
    skipDashboardFilterParens,
    samplingMode,
    widgetInterval,
  } = params;

  const {queue} = useWidgetQueryQueue();

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  // Check if organization has the async queue feature
  const seriesRequestData = filteredWidget.queries.map((_, queryIndex) => {
    const requestData = getSeriesRequestData(
      filteredWidget,
      queryIndex,
      organization,
      pageFilters,
      DiscoverDatasets.PREPROD_SIZE,
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
    const error = queryResults.find(q => q?.error)?.error as any;
    const errorMessage = error?.responseJSON?.detail || error?.message;

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: WidgetTimeSeries[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;

      const transformedResult = mobileAppSizeResponseTransforms.transformTimeSeries!(
        responseData,
        filteredWidget,
        requestIndex
      );

      timeseriesResults.push(...transformedResult);
    });

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      ingestion: combineIngestionMeta(queryResults.map(q => q?.data)),
      rawData,
    };
  })();

  return transformedData;
}

/**
 * MobileAppSize doesn't have table support, so this is a placeholder
 * that returns empty data. This is needed for API compatibility.
 */
export function useMobileAppSizeTableQuery(
  _params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  return {
    loading: false,
    errorMessage: undefined,
    tableResults: [],
    rawData: EMPTY_ARRAY,
  };
}
