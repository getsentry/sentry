import {useCallback, useMemo, useRef} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import type {ApiResult} from 'sentry/api';
import type {Series} from 'sentry/types/echarts';
import type {EventsStats, MultiSeriesEventsStats} from 'sentry/types/organization';
import {getUtcDateString} from 'sentry/utils/dates';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueries} from 'sentry/utils/queryClient';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {MobileAppSizeConfig} from 'sentry/views/dashboards/datasetConfig/mobileAppSize';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  cleanWidgetForRequest,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

type MobileAppSizeSeriesResponse = EventsStats | MultiSeriesEventsStats;

/**
 * Helper to apply dashboard filters and clean widget for API request
 */
function applyDashboardFilters(
  widget: Widget,
  dashboardFilters?: DashboardFilters,
  skipParens?: boolean
): Widget {
  let processedWidget = widget;

  // Apply dashboard filters if provided
  if (dashboardFilters) {
    const filtered = cloneDeep(widget);
    const dashboardFilterConditions = dashboardFiltersToString(
      dashboardFilters,
      filtered.widgetType
    );

    filtered.queries.forEach(query => {
      if (dashboardFilterConditions) {
        if (query.conditions && !skipParens) {
          query.conditions = `(${query.conditions})`;
        }
        query.conditions = query.conditions + ` ${dashboardFilterConditions}`;
      }
    });

    processedWidget = filtered;
  }

  return cleanWidgetForRequest(processedWidget);
}

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
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<MobileAppSizeSeriesResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const queryKeys = useMemo(() => {
    const keys = filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.PREPROD_SIZE,
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
      async (context: any): Promise<ApiResult<MobileAppSizeSeriesResponse>> => {
        // If queue is available, wrap the API call to go through the queue
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<MobileAppSizeSeriesResponse>(context).then(
                  resolve,
                  reject
                ),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        return fetchDataQuery<MobileAppSizeSeriesResponse>(context);
      },
    [queue]
  );

  // Check if organization has the async queue feature
  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const queryResults = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFn(),
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
      placeholderData: (previousData: unknown) => previousData,
    })),
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.[0]);
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
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      rawData[requestIndex] = responseData;

      const transformedResult = MobileAppSizeConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      transformedResult.forEach((result: Series, resultIndex: number) => {
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
    if (prevRawDataRef.current && prevRawDataRef.current.length === rawData.length) {
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
