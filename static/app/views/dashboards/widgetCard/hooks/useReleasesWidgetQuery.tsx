import {useCallback, useMemo} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';
import {useQueries} from '@tanstack/react-query';

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
import {getWidgetInterval} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {applyDashboardFiltersToWidget} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {requiresCustomReleaseSorting} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

import {getReleasesRequestData} from './utils/releases';

const EMPTY_ARRAY: any[] = [];

function combineQueryResultsWithRequestError<T>(
  results: Array<UseQueryResult<ApiResult<T>, Error>>
) {
  return {
    isFetching: results.some(q => q?.isFetching),
    allHaveData: results.every(q => q?.data?.[0]),
    firstError: results.find(q => q?.error)?.error as RequestError | undefined,
    queryData: results.map(q => q.data),
  };
}

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

  const filteredWidget = useMemo(() => {
    return applyDashboardFiltersToWidget(
      widget,
      dashboardFilters,
      skipDashboardFilterParens
    );
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

  const {isFetching, allHaveData, firstError, queryData} = useQueries({
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
    combine: combineQueryResultsWithRequestError,
  });

  const transformedData = useMemo(() => {
    if (validationError) {
      return {
        loading: false,
        errorMessage: validationError,
        rawData: EMPTY_ARRAY,
      };
    }

    const errorMessage = firstError
      ? firstError.responseJSON?.detail
        ? typeof firstError.responseJSON.detail === 'string'
          ? firstError.responseJSON.detail
          : firstError.responseJSON.detail.message
        : firstError.message || t('An unknown error occurred.')
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

    queryData.forEach((data, requestIndex) => {
      if (!data?.[0]) {
        return;
      }

      const responseData = data[0];
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

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      tableResults: undefined,
      rawData,
    };
  }, [
    validationError,
    isFetching,
    allHaveData,
    firstError,
    queryData,
    filteredWidget,
    organization,
  ]);

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

  const filteredWidget = useMemo(() => {
    return applyDashboardFiltersToWidget(
      widget,
      dashboardFilters,
      skipDashboardFilterParens
    );
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

  const {isFetching, allHaveData, firstError, queryData} = useQueries({
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
    combine: combineQueryResultsWithRequestError,
  });

  const transformedData = useMemo(() => {
    if (validationError) {
      return {
        loading: false,
        errorMessage: validationError,
        rawData: EMPTY_ARRAY,
      };
    }

    const errorMessage = firstError
      ? firstError.responseJSON?.detail
        ? typeof firstError.responseJSON.detail === 'string'
          ? firstError.responseJSON.detail
          : firstError.responseJSON.detail.message
        : firstError.message || t('An unknown error occurred.')
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

    queryData.forEach((data, i) => {
      if (!data?.[0]) {
        return;
      }

      const responseData = data[0];
      const responseMeta = data[2];
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

    return {
      loading: false,
      errorMessage: undefined,
      tableResults,
      timeseriesResults: undefined,
      pageLinks: responsePageLinks,
      rawData,
    };
  }, [
    validationError,
    isFetching,
    allHaveData,
    firstError,
    queryData,
    filteredWidget,
    organization,
    pageFilters,
  ]);

  return transformedData;
}
