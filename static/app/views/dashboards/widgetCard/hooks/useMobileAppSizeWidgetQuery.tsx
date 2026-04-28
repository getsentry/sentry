import {useMemo, useRef} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';

import type {Series} from 'sentry/types/echarts';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {MobileAppSizeConfig} from 'sentry/views/dashboards/datasetConfig/mobileAppSize';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

type MobileAppSizeSeriesResponse = EventsStats | MultiSeriesEventsStats;

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
    enabled = true,
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

  // Check if organization has the async queue feature
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
        DiscoverDatasets.PREPROD_SIZE,
        getReferrer(filteredWidget.displayType),
        widgetInterval
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

      return queryOptions({
        ...apiOptions.as<MobileAppSizeSeriesResponse>()(
          '/organizations/$organizationIdOrSlug/events-stats/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<MobileAppSizeSeriesResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<MobileAppSizeSeriesResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<MobileAppSizeSeriesResponse>(context);
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
