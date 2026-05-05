import {useMemo, useRef} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';

import {releaseHealthApiOptions} from 'sentry/actionCreators/metrics';
import {sessionsApiOptions} from 'sentry/actionCreators/sessions';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {SessionApiResponse} from 'sentry/types/organization';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {getWidgetInterval} from 'sentry/views/dashboards/utils';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {applyDashboardFiltersToWidget} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {requiresCustomReleaseSorting} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

import {getReleasesRequestData} from './utils/releases';

const EMPTY_ARRAY: any[] = [];

export function useReleasesSeriesQuery(params: WidgetQueryParams): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    dashboardFilters,
    skipDashboardFilterParens,
    widgetInterval,
  } = params;

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<SessionApiResponse[] | undefined>(undefined);

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

  // Compute validation error and request options together
  const {queryRequests, validationError} = useMemo(() => {
    try {
      const requests = filteredWidget.queries.map(query => {
        const {datetime} = pageFilters;
        const {start, end, period} = datetime;

        const isCustomReleaseSorting = requiresCustomReleaseSorting(query);
        const includeTotals = query.columns.length > 0 ? 1 : 0;
        // When custom release sorting is active the metrics API cannot handle
        // high-fidelity series data for many rows, so always use medium fidelity
        // regardless of any user-selected interval.
        const interval = isCustomReleaseSorting
          ? getWidgetInterval(filteredWidget, {start, end, period}, '5m', 'medium')
          : (widgetInterval ??
            getWidgetInterval(filteredWidget, {start, end, period}, '5m'));

        return getReleasesRequestData(
          1, // includeSeries
          includeTotals,
          query,
          organization,
          pageFilters,
          interval,
          filteredWidget.limit ?? undefined
        );
      });
      return {queryRequests: requests, validationError: undefined};
    } catch (error) {
      // Catch synchronous errors from getReleasesRequestData (e.g., date validation)
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {queryRequests: [], validationError: errorMessage};
    }
  }, [filteredWidget, organization, pageFilters, widgetInterval]);

  const queryResults = useQueries({
    queries: queryRequests.map(requestData => {
      const baseOptions = requestData.useSessionAPI
        ? sessionsApiOptions(requestData)
        : releaseHealthApiOptions(requestData);

      return queryOptions({
        ...baseOptions,
        staleTime: getWidgetStaleTime(pageFilters),
        queryFn: (context): Promise<ApiResponse<SessionApiResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<SessionApiResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<SessionApiResponse>(context);
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
        select: selectJsonWithHeaders,
      });
    }),
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
    const allHaveData = queryResults.every(q => q?.data?.json);
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
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;
      rawData[requestIndex] = responseData;

      const transformedResult = ReleasesConfig.transformSeries?.(
        responseData,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      if (!transformedResult) {
        return;
      }

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
    });

    // Memoize raw data to prevent unnecessary rerenders
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

  const {queue} = useWidgetQueryQueue();
  const prevRawDataRef = useRef<SessionApiResponse[] | undefined>(undefined);

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

  // Compute validation error and request options together
  const {queryRequests, validationError} = useMemo(() => {
    try {
      const requests = filteredWidget.queries.map(query =>
        getReleasesRequestData(
          0, // includeSeries
          1, // includeTotals
          query,
          organization,
          pageFilters,
          undefined, // interval
          limit ?? filteredWidget.limit ?? undefined,
          cursor
        )
      );
      return {queryRequests: requests, validationError: undefined};
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {queryRequests: [], validationError: errorMessage};
    }
  }, [filteredWidget, organization, pageFilters, limit, cursor]);

  const queryResults = useQueries({
    queries: queryRequests.map(requestData => {
      const baseOptions = requestData.useSessionAPI
        ? sessionsApiOptions(requestData)
        : releaseHealthApiOptions(requestData);

      return queryOptions({
        ...baseOptions,
        staleTime: getWidgetStaleTime(pageFilters),
        queryFn: (context): Promise<ApiResponse<SessionApiResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<SessionApiResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<SessionApiResponse>(context);
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
        select: selectJsonWithHeaders,
      });
    }),
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
    const allHaveData = queryResults.every(q => q?.data?.json);
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
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;
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

      // Get page links from response headers
      responsePageLinks = q.data.headers.Link ?? undefined;
    });

    // Memoize raw data to prevent unnecessary rerenders
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
      tableResults,
      timeseriesResults: undefined,
      pageLinks: responsePageLinks,
      rawData: finalRawData,
    };
  })();

  return transformedData;
}
