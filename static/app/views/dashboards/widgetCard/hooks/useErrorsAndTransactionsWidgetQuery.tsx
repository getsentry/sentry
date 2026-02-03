import {useCallback, useMemo, useRef} from 'react';

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
import {
  doOnDemandMetricsRequest,
  ErrorsAndTransactionsConfig,
  getSeriesResultType,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {Widget} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget, hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

type ErrorsAndTransactionsSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats;
type ErrorsAndTransactionsTableResponse = TableData | EventsTableData;

const EMPTY_ARRAY: any[] = [];

function getQueryExtraForSplittingDiscover(
  widget: Widget,
  _organization: any,
  _useOnDemandMetrics: boolean
) {
  const isEditing = location.pathname.endsWith('/edit/');

  if (isEditing && widget.id) {
    return {dashboardWidgetId: widget.id};
  }

  return {};
}

export function useErrorsAndTransactionsSeriesQuery(
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
  const prevRawDataRef = useRef<ErrorsAndTransactionsSeriesResponse[] | undefined>(
    undefined
  );

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;
  const useOnDemandMetrics = shouldUseOnDemandMetrics(
    organization,
    filteredWidget,
    onDemandControlContext
  );

  const queryKeys = useMemo(() => {
    const keys = filteredWidget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        filteredWidget,
        queryIndex,
        organization,
        pageFilters,
        isMEPEnabled ? DiscoverDatasets.METRICS_ENHANCED : DiscoverDatasets.DISCOVER,
        getReferrer(filteredWidget.displayType)
      );

      const splitDiscoverExtras = getQueryExtraForSplittingDiscover(
        filteredWidget,
        organization,
        !!useOnDemandMetrics
      );

      const {
        organization: _org,
        includeAllArgs: _includeAllArgs,
        includePrevious: _includePrevious,
        generatePathname: _generatePathname,
        queryExtras: requestQueryExtras,
        period,
        ...restParams
      } = requestData;

      const queryParams = {
        ...restParams,
        ...(period ? {statsPeriod: period} : {}),
        ...requestQueryExtras,
        ...splitDiscoverExtras,
        ...(useOnDemandMetrics ? {dataset: DiscoverDatasets.METRICS_ENHANCED} : {}),
      };

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }
      // Convert boolean partial to string for API
      if (queryParams.partial !== undefined) {
        (queryParams as any).partial = queryParams.partial ? '1' : '0';
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
  }, [filteredWidget, organization, pageFilters, isMEPEnabled, useOnDemandMetrics]);

  const createQueryFn = useCallback(
    (queryIndex: number) =>
      async (context: any): Promise<ApiResult<ErrorsAndTransactionsSeriesResponse>> => {
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
            ...(getQueryExtraForSplittingDiscover(
              filteredWidget,
              organization,
              true
            ) as Record<string, any>),
            dataset: DiscoverDatasets.METRICS_ENHANCED,
          };

          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  doOnDemandMetricsRequest(
                    context.meta?.api,
                    requestData,
                    filteredWidget.widgetType
                  ).then(resolve, reject),
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

        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<ErrorsAndTransactionsSeriesResponse>(context).then(
                  resolve,
                  reject
                ),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }

        return fetchDataQuery<ErrorsAndTransactionsSeriesResponse>(context);
      },
    [useOnDemandMetrics, filteredWidget, organization, pageFilters, queue]
  );

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const queryResults = useQueries({
    queries: queryKeys.map((queryKey, queryIndex) => ({
      queryKey,
      queryFn: createQueryFn(queryIndex),
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
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.[0]);
    const error = queryResults.find(q => q?.error)?.error as any;

    const errorMessage = (() => {
      if (!error) {
        return undefined;
      }

      if (error.responseJSON?.detail) {
        if (typeof error.responseJSON.detail === 'string') {
          return error.responseJSON.detail;
        }
        if (error.responseJSON.detail.message) {
          return error.responseJSON.detail.message;
        }
        return error.message || 'An unknown error occurred.';
      }

      return error.message || 'An unknown error occurred.';
    })();

    if (!allHaveData || isFetching) {
      return {
        loading: isFetching,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: Series[] = [];
    const timeseriesResultsTypes: Record<string, any> = {};
    const rawData: ErrorsAndTransactionsSeriesResponse[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data?.[0]) {
        return;
      }

      let responseData = q.data[0];

      if (
        hasDatasetSelector(organization) &&
        filteredWidget.widgetType === WidgetType.DISCOVER
      ) {
        const meta: any = responseData.meta ?? {};
        if (!meta.discoverSplitDecision && useOnDemandMetrics) {
          meta.discoverSplitDecision = 'transaction-like';
          responseData = {...responseData, meta};
        }
      }

      rawData[requestIndex] = responseData;

      const transformedResult = ErrorsAndTransactionsConfig.transformSeries!(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });

      const resultTypes = getSeriesResultType(
        responseData,
        filteredWidget.queries[requestIndex]!
      );
      if (resultTypes) {
        Object.assign(timeseriesResultsTypes, resultTypes);
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
      rawData: finalRawData,
    };
  })();

  return transformedData;
}

export function useErrorsAndTransactionsTableQuery(
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
  const prevRawDataRef = useRef<ErrorsAndTransactionsTableResponse[] | undefined>(
    undefined
  );

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
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
      const eventView = eventViewFromWidget('', query, pageFilters);

      const queryExtras: Record<string, any> = {
        ...getQueryExtraForSplittingDiscover(
          filteredWidget,
          organization,
          !!useOnDemandMetrics
        ),
        useOnDemandMetrics: !!useOnDemandMetrics,
        onDemandType: 'dynamic_query',
      };

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: isMEPEnabled
          ? DiscoverDatasets.METRICS_ENHANCED
          : DiscoverDatasets.DISCOVER,
        ...queryExtras,
      };

      if (query.orderby) {
        requestParams.sort =
          typeof query.orderby === 'string' ? [query.orderby] : query.orderby;
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
      async (context: any): Promise<ApiResult<ErrorsAndTransactionsTableResponse>> => {
        if (queue) {
          return new Promise((resolve, reject) => {
            const fetchFnRef = {
              current: () =>
                fetchDataQuery<ErrorsAndTransactionsTableResponse>(context).then(
                  resolve,
                  reject
                ),
            };
            queue.addItem({fetchDataRef: fetchFnRef});
          });
        }
        return fetchDataQuery<ErrorsAndTransactionsTableResponse>(context);
      },
    [queue]
  );

  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const queryResults = useQueries({
    queries: queryKeys.map(queryKey => ({
      queryKey,
      queryFn: createQueryFnTable(),
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
    })),
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.[0]);
    const error = queryResults.find(q => q?.error)?.error as any;

    const errorMessage = (() => {
      if (!error) {
        return undefined;
      }

      if (error.responseJSON?.detail) {
        if (typeof error.responseJSON.detail === 'string') {
          return error.responseJSON.detail;
        }
        if (error.responseJSON.detail.message) {
          return error.responseJSON.detail.message;
        }
        return error.message || 'An unknown error occurred.';
      }

      return error.message || 'An unknown error occurred.';
    })();

    if (!allHaveData || isFetching) {
      return {
        loading: isFetching,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    const rawData: ErrorsAndTransactionsTableResponse[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.[0]) {
        return;
      }

      const responseData = q.data[0];
      const responseMeta = q.data[2];
      rawData[i] = responseData;

      const transformedDataItem: TableDataWithTitle = {
        ...ErrorsAndTransactionsConfig.transformTable(
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
