import {useMemo, useRef} from 'react';
import {useQueries} from '@tanstack/react-query';

import type {Series} from 'sentry/types/echarts';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {MobileAppSizeConfig} from 'sentry/views/dashboards/datasetConfig/mobileAppSize';
import {
  getSeriesRequestData,
  getTimeseriesQueryParams,
} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {getTimeseriesWidgetQueryOptions} from 'sentry/views/dashboards/widgetCard/hooks/utils/getTimeseriesWidgetQueryOptions';

type MobileAppSizeSeriesResponse = EventsTimeSeriesResponse;

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
  const prevRawDataRef = useRef<MobileAppSizeSeriesResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const queryResults = useQueries({
    queries: filteredWidget.queries.map((_, queryIndex) => {
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

      return getTimeseriesWidgetQueryOptions({
        organization,
        pageFilters,
        queue,
        enabled,
        query: getTimeseriesQueryParams(requestData),
      });
    }),
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

    const timeseriesResults: Series[] = [];
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};
    const rawData: MobileAppSizeSeriesResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;
      rawData[requestIndex] = responseData;

      const transformedResult = MobileAppSizeConfig.transformSeries!(
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

      const resultTypes = MobileAppSizeConfig.getSeriesResultType?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );

      if (resultTypes) {
        Object.assign(timeseriesResultsTypes, resultTypes);
      }

      const resultUnits = MobileAppSizeConfig.getSeriesResultUnit?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );

      if (resultUnits) {
        Object.assign(timeseriesResultsUnits, resultUnits);
      }
    });

    let finalRawData = rawData;
    // oxlint-disable-next-line react/refs
    if (prevRawDataRef.current?.length === rawData.length) {
      // oxlint-disable-next-line react/refs
      const allSame = rawData.every((data, i) => data === prevRawDataRef.current?.[i]);
      if (allSame) {
        // oxlint-disable-next-line react/refs
        finalRawData = prevRawDataRef.current;
      }
    }

    // oxlint-disable-next-line react/refs
    if (finalRawData !== prevRawDataRef.current) {
      // oxlint-disable-next-line react/refs
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
