import {useMemo} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import trimStart from 'lodash/trimStart';

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
import {useApiQueries} from 'sentry/utils/queryClient';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {
  dashboardFiltersToString,
  eventViewFromWidget,
} from 'sentry/views/dashboards/utils';
import type {GenericWidgetQueriesResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
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
 * Handles all widget queries in parallel, transforms data, and returns final results.
 */
export function useSpansSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): GenericWidgetQueriesResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    samplingMode,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  // Apply dashboard filters
  const filteredWidget = useMemo(
    () => applyDashboardFilters(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  // Build query keys for all widget queries
  const queryKeys = useMemo(() => {
    return filteredWidget.queries.map((_, queryIndex) => {
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

      // Build the API query key for events-stats endpoint
      return [
        `/organizations/${organization.slug}/events-stats/`,
        {
          method: 'GET' as const,
          query: requestData,
        },
      ] satisfies ApiQueryKey;
    });
  }, [filteredWidget, organization, pageFilters, samplingMode]);

  // Use useApiQueries to fetch all queries in parallel
  const queryResults = useApiQueries<SpansSeriesResponse>(queryKeys, {
    staleTime: 0,
    enabled,
    retry: false,
  });

  // Transform data after all queries complete
  const transformedData = useMemo(() => {
    const allSuccessful = queryResults.every(q => q && q.isSuccess);
    const isLoading = queryResults.some(q => q && q.isLoading);
    const errorMessage = queryResults.find(q => q && q.error)?.error?.message;

    if (!allSuccessful || isLoading) {
      return {
        loading: isLoading || !queryResults.length,
        errorMessage,
      };
    }

    const timeseriesResults: Series[] = [];
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};

    queryResults.forEach((q, requestIndex) => {
      if (!q || !q.data) {
        return;
      }

      // Transform the data
      const transformedResult = SpansConfig.transformSeries!(
        q.data,
        filteredWidget.queries[requestIndex]!,
        organization
      );

      // Maintain color consistency
      transformedResult.forEach((result: Series, resultIndex: number) => {
        timeseriesResults[requestIndex * transformedResult.length + resultIndex] = result;
      });

      // Get result types and units (these are optional in the config)
      // For spans, these methods don't exist, so we skip them
    });

    return {
      loading: false,
      errorMessage: undefined,
      timeseriesResults,
      timeseriesResultsTypes,
      timeseriesResultsUnits,
    };
  }, [queryResults, filteredWidget, organization]);

  return transformedData;
}

/**
 * Hook for fetching Spans widget table data using React Query.
 * Handles all widget queries in parallel, transforms data, and returns final results.
 */
export function useSpansTableQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): GenericWidgetQueriesResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled,
    samplingMode,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

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

  // Use useApiQueries to fetch all queries in parallel
  const queryResults = useApiQueries<SpansTableResponse>(queryKeys, {
    staleTime: 0,
    enabled,
    retry: false,
  });

  // Transform data after all queries complete
  const transformedData = useMemo(() => {
    const allSuccessful = queryResults.every(q => q && q.isSuccess);
    const isLoading = queryResults.some(q => q && q.isLoading);
    const errorMessage = queryResults.find(q => q && q.error)?.error?.message;

    if (!allSuccessful || isLoading) {
      return {
        loading: isLoading || !queryResults.length,
        errorMessage,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    let responsePageLinks: string | undefined;

    queryResults.forEach((q, i) => {
      if (!q || !q.data) {
        return;
      }

      const transformedDataItem: TableDataWithTitle = {
        ...SpansConfig.transformTable(
          q.data,
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

      // Get page links from response
      responsePageLinks = q.getResponseHeader?.('Link') ?? undefined;
    });

    return {
      loading: false,
      errorMessage: undefined,
      tableResults,
      pageLinks: responsePageLinks,
    };
  }, [queryResults, filteredWidget, organization, pageFilters]);

  return transformedData;
}
