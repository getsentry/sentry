import {useCallback, useEffect, useMemo, useRef} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import type {ApiResult} from 'sentry/api';
import GroupStore from 'sentry/stores/groupStore';
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

function applyDashboardFilters(
  widget: Widget,
  dashboardFilters?: DashboardFilters,
  skipParens?: boolean
): Widget {
  let processedWidget = widget;

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
        DiscoverDatasets.ISSUE_PLATFORM,
        getReferrer(filteredWidget.displayType)
      );

      requestData.generatePathname = () =>
        `/organizations/${organization.slug}/issues-timeseries/`;

      requestData.queryExtras = {
        ...requestData.queryExtras,
        category: 'issue',
      };

      const {
        organization: _org,
        includeAllArgs: _includeAllArgs,
        includePrevious: _includePrevious,
        generatePathname: _generatePathname,
        dataset: _dataset,
        period,
        queryExtras,
        ...restParams
      } = requestData;

      const queryParams = {
        ...restParams,
        ...queryExtras,
        ...(period ? {statsPeriod: period} : {}),
      };

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }

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
                  reject(error instanceof Error ? error : new Error(String(error)));
                }
              },
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

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

      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });
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
      rawData: finalRawData,
    };
  })();

  return transformedData;
}

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
    const keys = filteredWidget.queries.map(query => {
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
          data: queryParams,
        },
      ];

      return baseQueryKey;
    });

    return keys;
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
                  reject(error instanceof Error ? error : new Error(String(error)));
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

  // Populate GroupStore in effect (outside render phase)
  // Track by data reference to avoid redundant calls
  const prevGroupDataRef = useRef<IssuesTableResponse[]>([]);
  useEffect(() => {
    queryResults.forEach((q, i) => {
      const data = q?.data?.[0];
      if (data && data !== prevGroupDataRef.current[i]) {
        GroupStore.add(data);
        prevGroupDataRef.current[i] = data;
      }
    });
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

      responsePageLinks = responseMeta?.getResponseHeader('Link') ?? undefined;
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
      tableResults,
      pageLinks: responsePageLinks,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}
