import {useCallback, useMemo, useRef} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import type {ApiResult} from 'sentry/api';
import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getUtcDateString} from 'sentry/utils/dates';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {shouldUseOnDemandMetrics} from 'sentry/utils/performance/contexts/onDemandControl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueries} from 'sentry/utils/queryClient';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {doOnDemandMetricsRequest} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {
  dashboardFiltersToString,
  eventViewFromWidget,
} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  cleanWidgetForRequest,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

type TransactionsSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats;
type TransactionsTableResponse = TableData | EventsTableData;

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
        // If there is no base query, there's no need to add parens
        if (query.conditions && !skipParens) {
          query.conditions = `(${query.conditions})`;
        }
        query.conditions = query.conditions + ` ${dashboardFilterConditions}`;
      }
    });

    processedWidget = filtered;
  }

  // Clean widget to remove empty/invalid fields before API request
  return cleanWidgetForRequest(processedWidget);
}

// Stable empty array to prevent infinite rerenders
const EMPTY_ARRAY: any[] = [];

/**
 * Hook for fetching Transactions widget series data (charts) using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useTransactionsSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true,
    dashboardFilters,
    skipDashboardFilterParens,
    mepSetting,
    onDemandControlContext,
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<TransactionsSeriesResponse[] | undefined>(undefined);

  // Apply dashboard filters
  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;
  const useOnDemandMetrics = shouldUseOnDemandMetrics(
    organization,
    filteredWidget,
    onDemandControlContext
  );

  // Build query keys for all widget queries
  const queryKeys = useMemo(() => {
    const keys = filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        isMEPEnabled ? DiscoverDatasets.METRICS_ENHANCED : DiscoverDatasets.TRANSACTIONS,
        getReferrer(filteredWidget.displayType)
      );

      // Handle on-demand metrics
      if (useOnDemandMetrics) {
        requestData.queryExtras = {
          ...requestData.queryExtras,
          dataset: DiscoverDatasets.METRICS_ENHANCED,
        };
      }

      // Transform requestData into proper query params
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

      // Build the API query key for events-stats endpoint
      return [
        `/organizations/${organization.slug}/events-stats/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ] satisfies ApiQueryKey;
    });
    return keys;
  }, [filteredWidget, organization, pageFilters, isMEPEnabled, useOnDemandMetrics]);

  // Create stable queryFn that uses queue
  const createQueryFn = useCallback(
    (queryIndex: number) =>
      async (context: any): Promise<ApiResult<TransactionsSeriesResponse>> => {
        // For on-demand metrics, we need to use a special request function
        if (useOnDemandMetrics) {
          const requestData = getSeriesRequestData(
            filteredWidget,
            queryIndex,
            organization,
            pageFilters,
            DiscoverDatasets.METRICS_ENHANCED,
            getReferrer(filteredWidget.displayType)
          );

          requestData.queryExtras = {
            ...requestData.queryExtras,
            dataset: DiscoverDatasets.METRICS_ENHANCED,
          };

          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: async () => {
                  try {
                    const result = await doOnDemandMetricsRequest(
                      context.meta?.api,
                      requestData,
                      filteredWidget.widgetType
                    );
                    resolve(result);
                  } catch (error) {
                    reject(error);
                  }
                },
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }

          return doOnDemandMetricsRequest(
            context.meta?.api,
            requestData,
            filteredWidget.widgetType
          );
        }

        // Standard request flow
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result =
                    await fetchDataQuery<TransactionsSeriesResponse>(context);
                  resolve(result);
                } catch (error) {
                  reject(error);
                }
              },
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        // Fallback: call directly if queue not available
        return fetchDataQuery<TransactionsSeriesResponse>(context);
      },
    [useOnDemandMetrics, filteredWidget, organization, pageFilters, queue]
  );

  // Check if organization has the async queue feature
  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const queryResults = useQueries({
    queries: queryKeys.map((queryKey, queryIndex) => ({
      queryKey,
      queryFn: createQueryFn(queryIndex),
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
    const rawData: TransactionsSeriesResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      rawData[requestIndex] = responseData;

      const transformedResult = TransactionsConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      // Maintain color consistency
      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });
    });

    // Check if rawData is the same as before to prevent unnecessary rerenders
    let finalRawData = rawData;
    if (prevRawDataRef.current && prevRawDataRef.current.length === rawData.length) {
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
      timeseriesResults,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}

/**
 * Hook for fetching Transactions widget table data using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useTransactionsTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
    mepSetting,
    onDemandControlContext,
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<TransactionsTableResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;
  const useOnDemandMetrics = shouldUseOnDemandMetrics(
    organization,
    filteredWidget,
    onDemandControlContext
  );

  const queryKeys = useMemo(() => {
    return filteredWidget.queries.map(query => {
      // Clone the query to avoid mutating the original
      const modifiedQuery = cloneDeep(query);

      // To generate the target url for TRACE ID links we always include a timestamp,
      // to speed up the trace endpoint. Adding timestamp for the non-aggregate case and
      // max(timestamp) for the aggregate case as fields, to accomodate this.
      if (
        modifiedQuery.aggregates.length &&
        modifiedQuery.columns.includes('trace') &&
        !modifiedQuery.aggregates.includes('max(timestamp)') &&
        !modifiedQuery.columns.includes('timestamp')
      ) {
        modifiedQuery.aggregates.push('max(timestamp)');
      } else if (
        modifiedQuery.columns.includes('trace') &&
        !modifiedQuery.columns.includes('timestamp')
      ) {
        modifiedQuery.columns.push('timestamp');
      }

      const eventView = eventViewFromWidget('', modifiedQuery, pageFilters);

      const queryExtras = useOnDemandMetrics
        ? {useOnDemandMetrics: true, onDemandType: 'dynamic_query'}
        : {};

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: isMEPEnabled
          ? DiscoverDatasets.METRICS_ENHANCED
          : DiscoverDatasets.TRANSACTIONS,
        ...queryExtras,
      };

      if (modifiedQuery.orderby) {
        requestParams.sort =
          typeof modifiedQuery.orderby === 'string'
            ? [modifiedQuery.orderby]
            : modifiedQuery.orderby;
      }

      const queryParams = {
        ...eventView.generateQueryStringObject(),
        ...requestParams,
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
  }, [
    filteredWidget,
    organization,
    pageFilters,
    cursor,
    limit,
    isMEPEnabled,
    useOnDemandMetrics,
  ]);

  const createQueryFnTable = useCallback(
    () =>
      async (context: any): Promise<ApiResult<TransactionsTableResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchDataQuery<TransactionsTableResponse>(context);
                  resolve(result);
                } catch (error) {
                  reject(error);
                }
              },
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }
        return fetchDataQuery<TransactionsTableResponse>(context);
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
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.[0]);
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
    const rawData: TransactionsTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      const responseMeta = q.data[2];
      rawData[i] = responseData;

      const transformedDataItem: TableDataWithTitle = {
        ...TransactionsConfig.transformTable(
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

    // Check if rawData is the same as before to prevent unnecessary rerenders
    let finalRawData = rawData;
    if (prevRawDataRef.current && prevRawDataRef.current.length === rawData.length) {
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
