import {useMemo} from 'react';
import {queryOptions, useQueries} from '@tanstack/react-query';
import cloneDeep from 'lodash/cloneDeep';

import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {eventsResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/eventsResponseTransforms';
import {getTimeseriesRequestQuery} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {
  combineIngestionMeta,
  type WidgetTimeSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  combineWidgetJsonQueryResults,
  combineWidgetQueryResults,
} from 'sentry/views/dashboards/widgetCard/hooks/utils/combineWidgetQueryResults';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {getTimeseriesWidgetQueryOptions} from 'sentry/views/dashboards/widgetCard/hooks/utils/getTimeseriesWidgetQueryOptions';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';

type ErrorsTableResponse = TableData | EventsTableData;

const EMPTY_ARRAY: any[] = [];

export function useErrorsSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    dashboardFilters,
    skipDashboardFilterParens,
    samplingMode,
    widgetInterval,
  } = params;

  const {queue} = useWidgetQueryQueue();

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const {results: queryResults, data: rawData} = useQueries({
    queries: filteredWidget.queries.map((_, queryIndex) =>
      getTimeseriesWidgetQueryOptions({
        organization,
        pageFilters,
        queue,
        enabled,
        query: getTimeseriesRequestQuery(
          filteredWidget,
          queryIndex,
          pageFilters,
          DiscoverDatasets.ERRORS,
          {
            referrer: getReferrer(filteredWidget.displayType),
            widgetInterval,
            sampling: samplingMode,
          }
        ),
      })
    ),
    combine: combineWidgetQueryResults,
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data);
    const errorMessage = queryResults.find(q => q?.error)?.error?.message;

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: WidgetTimeSeries[] = [];

    queryResults.forEach((q, requestIndex) => {
      if (!q?.data) {
        return;
      }

      const responseData = q.data;

      const transformedResult = eventsResponseTransforms.transformTimeSeries!(
        responseData,
        filteredWidget,
        requestIndex
      );

      timeseriesResults.push(...transformedResult);
    });

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      ingestion: combineIngestionMeta(queryResults.map(q => q?.data)),
      rawData,
    };
  })();

  return transformedData;
}

export function useErrorsTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
    samplingMode,
  } = params;

  const {queue} = useWidgetQueryQueue();

  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const {results: queryResults, data: rawData} = useQueries({
    queries: filteredWidget.queries.map(query => {
      const modifiedQuery = cloneDeep(query);

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

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: DiscoverDatasets.ERRORS,
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
        ...(samplingMode ? {sampling: samplingMode} : {}),
      };

      return queryOptions({
        ...apiOptions.as<ErrorsTableResponse>()(
          '/organizations/$organizationIdOrSlug/events/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<ErrorsTableResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<ErrorsTableResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<ErrorsTableResponse>(context);
        },
        enabled,
        retry: false,
        retryDelay: getRetryDelay,
        select: selectJsonWithHeaders,
      });
    }),
    combine: combineWidgetJsonQueryResults,
  });

  const transformedData = (() => {
    const isFetching = queryResults.some(q => q?.isFetching);
    const allHaveData = queryResults.every(q => q?.data?.json);
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
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;

      const transformedDataItem: TableDataWithTitle = {
        ...eventsResponseTransforms.transformTable(
          responseData,
          filteredWidget.queries[i]!,
          organization,
          pageFilters
        ),
        title: filteredWidget.queries[i]?.name ?? '',
      };

      tableResults.push(transformedDataItem);

      responsePageLinks = q.data.headers.Link;
    });

    return {
      loading: false,
      errorMessage: undefined,
      tableResults,
      pageLinks: responsePageLinks,
      rawData,
    };
  })();

  return transformedData;
}
