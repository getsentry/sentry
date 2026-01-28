import {useCallback, useMemo, useRef} from 'react';
import {useQueries} from '@tanstack/react-query';
import cloneDeep from 'lodash/cloneDeep';

import {doReleaseHealthRequest} from 'sentry/actionCreators/metrics';
import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import type {ApiResult} from 'sentry/api';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {dashboardFiltersToString, getWidgetInterval} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {cleanWidgetForRequest} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {requiresCustomReleaseSorting} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

import {getReleasesRequestData} from './utils/releases';

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

export function useReleasesSeriesQuery(params: WidgetQueryParams): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const api = useApi();
  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<SessionApiResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(() => {
    return applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens);
  }, [widget, dashboardFilters, skipDashboardFilterParens]);

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  // Compute validation error and query keys together
  const {queryKeys, validationError} = useMemo(() => {
    try {
      const keys = filteredWidget.queries.map((query, queryIndex) => {
        const {datetime} = pageFilters;
        const {start, end, period} = datetime;

        const isCustomReleaseSorting = requiresCustomReleaseSorting(query);
        const includeTotals = query.columns.length > 0 ? 1 : 0;
        const interval = getWidgetInterval(
          filteredWidget,
          {start, end, period},
          '5m',
          // requesting medium fidelity for release sort because metrics api can't return 100 rows of high fidelity series data
          isCustomReleaseSorting ? 'medium' : undefined
        );

        const requestData = getReleasesRequestData(
          1, // includeSeries
          includeTotals,
          query,
          organization,
          pageFilters,
          interval,
          filteredWidget.limit
        );

        return {
          queryKey: [
            `/organizations/${organization.slug}/sessions/`,
            {method: 'GET' as const, query: requestData},
          ],
          queryIndex,
          useSessionAPI: requestData.useSessionAPI,
        };
      });
      return {queryKeys: keys, validationError: undefined};
    } catch (error) {
      // Catch synchronous errors from getReleasesRequestData (e.g., date validation)
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Return empty array to prevent queries from running
      return {queryKeys: [], validationError: errorMessage};
    }
  }, [filteredWidget, organization, pageFilters]);

  const createQueryFn = useCallback(
    (useSessionAPI: boolean) =>
      async (context: any): Promise<ApiResult<SessionApiResponse>> => {
        const queryParams = context.queryKey[1].query;

        const fetchFn = async () => {
          if (useSessionAPI) {
            return doSessionsRequest(api, queryParams);
          }
          return doReleaseHealthRequest(api, queryParams);
        };

        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchFn();
                  resolve(result);
                } catch (error) {
                  reject(error instanceof Error ? error : new Error(String(error)));
                }
              },
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        return fetchFn();
      },
    [api, queue]
  );

  const queryResults = useQueries({
    queries: queryKeys.map(({queryKey, useSessionAPI}) => ({
      queryKey,
      queryFn: createQueryFn(useSessionAPI),
      staleTime: 0,
      enabled,
      retry: hasQueueFeature
        ? false
        : (failureCount: number, error: any) => {
            if (error?.status === 429 && failureCount < 10) {
              return true;
            }
            return false;
          },
      placeholderData: (previousData: unknown) => previousData,
    })),
  });

  const transformedData = (() => {
    if (validationError) {
      return {
        loading: false,
        errorMessage: validationError,
        rawData: EMPTY_ARRAY,
      };
    }

    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.[0]);
    const error = queryResults.find(q => q?.error)?.error as RequestError | undefined;
    const errorMessage = error
      ? error.responseJSON?.detail
        ? typeof error.responseJSON.detail === 'string'
          ? error.responseJSON.detail
          : error.responseJSON.detail.message
        : error.message || t('An unknown error occurred.')
      : undefined;

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: Series[] = [];
    const rawData: SessionApiResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      rawData[requestIndex] = responseData;

      const transformedResult = ReleasesConfig.transformSeries?.(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      if (!transformedResult) {
        return;
      }

      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });
    });

    // Memoize raw data to prevent unnecessary rerenders
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
      tableResults: undefined,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}

export function useReleasesTableQuery(params: WidgetQueryParams): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const api = useApi();
  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<SessionApiResponse[] | undefined>(undefined);

  const filteredWidget = useMemo(() => {
    return applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens);
  }, [widget, dashboardFilters, skipDashboardFilterParens]);

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  // Compute validation error and query keys together
  const {queryKeys, validationError} = useMemo(() => {
    try {
      const keys = filteredWidget.queries.map((query, queryIndex) => {
        const requestData = getReleasesRequestData(
          0, // includeSeries
          1, // includeTotals
          query,
          organization,
          pageFilters,
          undefined, // interval
          limit ?? filteredWidget.limit,
          cursor
        );

        return {
          queryKey: [
            `/organizations/${organization.slug}/sessions/`,
            {method: 'GET' as const, query: requestData},
          ],
          queryIndex,
          useSessionAPI: requestData.useSessionAPI,
        };
      });
      return {queryKeys: keys, validationError: undefined};
    } catch (error) {
      // Catch synchronous errors from getReleasesRequestData (e.g., date validation)
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Return empty array to prevent queries from running
      return {queryKeys: [], validationError: errorMessage};
    }
  }, [filteredWidget, organization, pageFilters, limit, cursor]);

  const createQueryFn = useCallback(
    (useSessionAPI: boolean) =>
      async (context: any): Promise<ApiResult<SessionApiResponse>> => {
        const queryParams = context.queryKey[1].query;

        const fetchFn = async () => {
          if (useSessionAPI) {
            return doSessionsRequest(api, queryParams);
          }
          return doReleaseHealthRequest(api, queryParams);
        };

        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: async () => {
                try {
                  const result = await fetchFn();
                  resolve(result);
                } catch (error) {
                  reject(error instanceof Error ? error : new Error(String(error)));
                }
              },
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        return fetchFn();
      },
    [api, queue]
  );

  const queryResults = useQueries({
    queries: queryKeys.map(({queryKey, useSessionAPI}) => ({
      queryKey,
      queryFn: createQueryFn(useSessionAPI),
      staleTime: 0,
      enabled,
      retry: hasQueueFeature
        ? false
        : (failureCount: number, error: any) => {
            if (error?.status === 429 && failureCount < 10) {
              return true;
            }
            return false;
          },
      placeholderData: (previousData: unknown) => previousData,
    })),
  });

  const transformedData = (() => {
    if (validationError) {
      return {
        loading: false,
        errorMessage: validationError,
        rawData: EMPTY_ARRAY,
      };
    }

    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.[0]);
    const error = queryResults.find(q => q?.error)?.error as RequestError | undefined;
    const errorMessage = error
      ? error.responseJSON?.detail
        ? typeof error.responseJSON.detail === 'string'
          ? error.responseJSON.detail
          : error.responseJSON.detail.message
        : error.message || t('An unknown error occurred.')
      : undefined;

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    const rawData: SessionApiResponse[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      const responseMeta = q.data[2];
      rawData[i] = responseData;

      const tableData = ReleasesConfig.transformTable?.(
        responseData,
        filteredWidget.queries[i]!,
        organization,
        pageFilters
      );

      if (!tableData) {
        return;
      }

      const transformedDataItem: TableDataWithTitle = {
        ...tableData,
        title: filteredWidget.queries[i]?.name ?? '',
      };

      tableResults.push(transformedDataItem);

      // Get page links from response meta
      responsePageLinks = responseMeta?.getResponseHeader('Link') ?? undefined;
    });

    // Memoize raw data to prevent unnecessary rerenders
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
      timeseriesResults: undefined,
      pageLinks: responsePageLinks,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}
