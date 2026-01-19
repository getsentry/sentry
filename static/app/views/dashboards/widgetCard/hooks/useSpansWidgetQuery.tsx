import {useCallback, useMemo, useRef} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import trimStart from 'lodash/trimStart';

import type {ApiResult} from 'sentry/api';
import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import toArray from 'sentry/utils/array/toArray';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {
  getEquationAliasIndex,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueries} from 'sentry/utils/queryClient';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {
  dashboardFiltersToString,
  eventViewFromWidget,
} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {getReferrer} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

type SpansSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats;
type SpansTableResponse = TableData | EventsTableData;

/**
 * Helper to apply dashboard filters to a widget
 */
function applyDashboardFilters(
  widget: Widget,
  dashboardFilters?: DashboardFilters,
  skipParens?: boolean
): Widget {
  if (!dashboardFilters) {
    return widget;
  }

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

  return filtered;
}

/**
 * Hook for fetching Spans widget series data (charts) using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
// Stable empty array to prevent infinite rerenders
const EMPTY_ARRAY: any[] = [];

export function useSpansSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true, // Enabled by default - React Query auto-fetches when keys change
    samplingMode,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();

  // Cache the previous rawData array to prevent unnecessary rerenders
  const prevRawDataRef = useRef<SpansSeriesResponse[] | undefined>(undefined);

  // Apply dashboard filters
  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  // Build query keys for all widget queries
  const queryKeys = useMemo(() => {
    const keys = filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.SPANS,
        getReferrer(filteredWidget.displayType)
      );

      // Add sampling mode if provided
      if (samplingMode) {
        requestData.sampling = samplingMode;
      }

      // Transform requestData into proper query params
      // Remove organization (already in URL path) and internal flags
      // Rename 'period' to 'statsPeriod' to match API expectations
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
  }, [filteredWidget, organization, pageFilters, samplingMode]);

  // Use native useQueries with queue-integrated queryFn
  // React Query auto-refetches when keys change, but API calls go through the queue
  /* eslint-disable @tanstack/query/exhaustive-deps -- queue is provided via context and shouldn't be in query keys */
  const queryResults = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: async (context): Promise<ApiResult<SpansSeriesResponse>> => {
        // Cast context to have the correct queryKey type
        const apiContext = context as typeof context & {queryKey: ApiQueryKey};

        // If queue is available, wrap the API call to go through the queue
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchDataQuery<SpansSeriesResponse>(apiContext);
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
        return fetchDataQuery<SpansSeriesResponse>(apiContext);
      },
      staleTime: 0,
      enabled, // Auto-fetch when enabled and when keys change
      retry: false,
      // Keep data from previous query keys while fetching new data
      placeholderData: (previousData: unknown) => previousData,
    })),
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  // Store query results in ref for stable refetch callback
  const queryResultsRef = useRef(queryResults);
  queryResultsRef.current = queryResults;

  // Refetch function to trigger all queries
  const refetch = useCallback(async () => {
    await Promise.all(queryResultsRef.current.map(q => q?.refetch()));
  }, []);

  // Transform data after all queries complete
  const transformedData = useMemo(() => {
    // Check if all queries have completed fetching
    const isFetching = queryResults.some(q => q?.isFetching);

    // Check if all queries have data (data is ApiResult tuple: [response, statusText, meta])
    const allHaveData = queryResults.every(q => q?.data?.[0]);

    const errorMessage = queryResults.find(q => q?.error)?.error?.message;

    // Show loading state while fetching OR if queries don't have data yet
    if (!allHaveData || isFetching) {
      return {
        loading: true,
        errorMessage,
        rawData: EMPTY_ARRAY,
        refetch,
      };
    }

    const timeseriesResults: Series[] = [];
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};
    const rawData: SpansSeriesResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data?.[0]) {
        return;
      }

      // Extract actual data from ApiResult tuple [data, statusText, responseMeta]
      const responseData = q.data[0];

      // Store raw data for callbacks
      rawData[requestIndex] = responseData;

      // Transform the data
      const transformedResult = SpansConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      // Maintain color consistency
      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });

      // Get result types and units from config
      const resultTypes = SpansConfig.getSeriesResultType?.(
        responseData,
        filteredWidget.queries[requestIndex]!
      );
      const resultUnits = SpansConfig.getSeriesResultUnit?.(
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

    // Check if rawData is the same as before to prevent unnecessary rerenders
    // Compare each data object reference - if they're all the same, reuse previous array
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
      timeseriesResultsTypes,
      timeseriesResultsUnits,
      rawData: finalRawData,
      refetch,
    };
    // eslint-disable-next-line @tanstack/query/no-unstable-deps -- using ref to avoid instability
  }, [queryResults, filteredWidget, organization, refetch]);

  return transformedData;
}

/**
 * Hook for fetching Spans widget table data using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useSpansTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true, // Enabled by default - React Query auto-fetches when keys change
    samplingMode,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();

  // Cache the previous rawData array to prevent unnecessary rerenders
  const prevRawDataRef = useRef<SpansTableResponse[] | undefined>(undefined);

  // Apply dashboard filters
  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  // Build query keys for all widget queries
  const queryKeys = useMemo(() => {
    return filteredWidget.queries.map(query => {
      const eventView = eventViewFromWidget('', query, pageFilters);

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: DiscoverDatasets.SPANS,
      };

      // Handle orderby
      let orderBy = query.orderby;
      if (orderBy) {
        if (isEquationAlias(trimStart(orderBy, '-'))) {
          const equations = query.fields?.filter(isEquation) ?? [];
          const equationIndex = getEquationAliasIndex(trimStart(orderBy, '-'));

          const orderby = equations[equationIndex];
          if (orderby) {
            orderBy = orderBy.startsWith('-') ? `-${orderby}` : orderby;
          }
        }
        requestParams.sort = toArray(orderBy);
      }

      const queryParams = {
        ...eventView.generateQueryStringObject(),
        ...requestParams,
        ...(samplingMode ? {sampling: samplingMode} : {}),
      };

      // Build the API query key for events endpoint
      return [
        `/organizations/${organization.slug}/events/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ] satisfies ApiQueryKey;
    });
  }, [filteredWidget, organization, pageFilters, samplingMode, cursor, limit]);

  // Use native useQueries with queue-integrated queryFn
  // React Query auto-refetches when keys change, but API calls go through the queue
  /* eslint-disable @tanstack/query/exhaustive-deps -- queue is provided via context and shouldn't be in query keys */
  const queryResults = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: async (context): Promise<ApiResult<SpansTableResponse>> => {
        // Cast context to have the correct queryKey type
        const apiContext = context as typeof context & {queryKey: ApiQueryKey};

        // If queue is available, wrap the API call to go through the queue
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchDataQuery<SpansTableResponse>(apiContext);
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
        return fetchDataQuery<SpansTableResponse>(apiContext);
      },
      staleTime: 0,
      enabled,
      retry: false,
    })),
  });
  /* eslint-enable @tanstack/query/exhaustive-deps */

  // Store query results in ref for stable refetch callback
  const queryResultsRef2 = useRef(queryResults);
  queryResultsRef2.current = queryResults;

  // Refetch function to trigger all queries
  const refetch = useCallback(async () => {
    await Promise.all(queryResultsRef2.current.map(q => q?.refetch()));
  }, []);

  // Transform data after all queries complete
  const transformedData = useMemo(() => {
    // Check if all queries have completed fetching
    const isFetching = queryResults.some(q => q?.isFetching);

    // Check if all queries have data (data is ApiResult tuple: [response, statusText, meta])
    const allHaveData = queryResults.every(q => q?.data?.[0]);

    const errorMessage = queryResults.find(q => q?.error)?.error?.message;

    // Show loading state while fetching OR if queries don't have data yet
    if (!allHaveData || isFetching) {
      return {
        loading: true,
        errorMessage,
        rawData: EMPTY_ARRAY,
        refetch,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    const rawData: SpansTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.[0]) {
        return;
      }

      // Extract actual data from ApiResult tuple [data, statusText, responseMeta]
      const responseData = q.data[0];
      const responseMeta = q.data[2];

      // Store raw data for callbacks
      rawData[i] = responseData;

      const transformedDataItem: TableDataWithTitle = {
        ...SpansConfig.transformTable(
          responseData,
          filteredWidget.queries[0]!,
          organization,
          pageFilters
        ),
        title: filteredWidget.queries[i]?.name ?? '',
      };

      const meta = transformedDataItem.meta;
      const fieldMeta = filteredWidget.queries?.[i]?.fieldMeta;
      if (fieldMeta && meta) {
        fieldMeta.forEach((m, index) => {
          const field = filteredWidget.queries?.[i]?.fields?.[index];
          if (m && field) {
            meta.units![field] = m.valueUnit ?? '';
            meta.fields![field] = m.valueType;
          }
        });
      }

      tableResults.push(transformedDataItem);

      // Get page links from response meta
      responsePageLinks = responseMeta?.getResponseHeader('Link') ?? undefined;
    });

    // Check if rawData is the same as before to prevent unnecessary rerenders
    // Compare each data object reference - if they're all the same, reuse previous array
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
      refetch,
    };
    // eslint-disable-next-line @tanstack/query/no-unstable-deps -- using ref to avoid instability
  }, [queryResults, filteredWidget, organization, pageFilters, refetch]);

  return transformedData;
}
