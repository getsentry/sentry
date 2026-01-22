import {useCallback, useMemo, useRef} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import type {ApiResult} from 'sentry/api';
import type {Series} from 'sentry/types/echarts';
import type {Group} from 'sentry/types/group';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {fetchDataQuery, useQueries} from 'sentry/utils/queryClient';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {
  IssuesConfig,
  type IssuesSeriesResponse,
} from 'sentry/views/dashboards/datasetConfig/issues';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DEFAULT_TABLE_LIMIT} from 'sentry/views/dashboards/types';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  cleanWidgetForRequest,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_EXPAND = ['owners'];

type IssuesTableResponse = Group[];

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
 * Hook for fetching Issues widget series data (charts) using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useIssuesSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled = true,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<IssuesSeriesResponse[] | undefined>(undefined);

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
        DiscoverDatasets.ISSUE_PLATFORM,
        getReferrer(filteredWidget.displayType)
      );

      // Override pathname generation for issues timeseries endpoint
      requestData.generatePathname = () =>
        `/organizations/${organization.slug}/issues-timeseries/`;

      requestData.queryExtras = {
        ...requestData.queryExtras,
        category: 'issue',
      };

      // Transform requestData into proper query params
      // Remove organization, dataset (not needed for issues endpoint), and internal flags
      const {
        organization: _org,
        includeAllArgs: _includeAllArgs,
        includePrevious: _includePrevious,
        generatePathname: _generatePathname,
        dataset: _dataset,
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

      // Build the API query key for issues-timeseries endpoint
      return [
        `/organizations/${organization.slug}/issues-timeseries/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ] satisfies ApiQueryKey;
    });
    return keys;
  }, [filteredWidget, organization, pageFilters]);

  // Create stable queryFn that uses queue
  const createQueryFn = useCallback(
    () =>
      async (context: any): Promise<ApiResult<IssuesSeriesResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchDataQuery<IssuesSeriesResponse>(context);
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
        return fetchDataQuery<IssuesSeriesResponse>(context);
      },
    [queue]
  );

  const queryResults = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFn(),
      staleTime: 0,
      enabled,
      retry: false,
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
    const rawData: IssuesSeriesResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      rawData[requestIndex] = responseData;

      const transformedResult = IssuesConfig.transformSeries!(
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
 * Hook for fetching Issues widget table data using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
export function useIssuesTableQuery(
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
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<IssuesTableResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const queryKeys = useMemo(() => {
    return filteredWidget.queries.map(query => {
      const queryParams: any = {
        project: pageFilters.projects ?? [],
        environment: pageFilters.environments ?? [],
        query: query.conditions,
        sort: query.orderby || DEFAULT_SORT,
        expand: DEFAULT_EXPAND,
        limit: limit ?? DEFAULT_TABLE_LIMIT,
        cursor,
      };

      if (pageFilters.datetime.period) {
        queryParams.statsPeriod = pageFilters.datetime.period;
      }
      if (pageFilters.datetime.end) {
        queryParams.end = getUtcDateString(pageFilters.datetime.end);
      }
      if (pageFilters.datetime.start) {
        queryParams.start = getUtcDateString(pageFilters.datetime.start);
      }
      if (pageFilters.datetime.utc) {
        queryParams.utc = pageFilters.datetime.utc;
      }

      const baseQueryKey: ApiQueryKey = [
        `/organizations/${organization.slug}/issues/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ];

      return baseQueryKey;
    });
  }, [filteredWidget, organization, pageFilters, cursor, limit]);

  const createQueryFnTable = useCallback(
    () =>
      async (context: any): Promise<ApiResult<IssuesTableResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchDataQuery<IssuesTableResponse>(context);
                  resolve(result);
                } catch (error) {
                  reject(error);
                }
              },
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }
        return fetchDataQuery<IssuesTableResponse>(context);
      },
    [queue]
  );

  const queryResults = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFnTable(),
      staleTime: 0,
      enabled,
      retry: false,
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

    const tableResults: any[] = [];
    const rawData: IssuesTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      const responseMeta = q.data[2];
      rawData[i] = responseData;

      const transformedDataItem = {
        ...IssuesConfig.transformTable(
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
