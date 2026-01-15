import {useMemo} from 'react';
import trimStart from 'lodash/trimStart';

import toArray from 'sentry/utils/array/toArray';
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
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {eventViewFromWidget, isChartDisplayType} from 'sentry/views/dashboards/utils';
import {getReferrer} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';

type SpansSeriesResponse = any; // TODO: Import proper type from spans config
type SpansTableResponse = any; // TODO: Import proper type from spans config

/**
 * Hook for fetching Spans widget series data (charts) using React Query.
 * Handles all widget queries in parallel and returns raw API responses.
 * Transforms are applied by the widget config after data is fetched.
 */
export function useSpansSeriesQuery({
  widget,
  organization,
  pageFilters,
  enabled,
  samplingMode,
}: WidgetQueryParams) {
  // Build query keys for all widget queries
  const queryKeys = useMemo(() => {
    return widget.queries.map((_, queryIndex) => {
      const requestData = getSeriesRequestData(
        widget,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.SPANS,
        getReferrer(widget.displayType)
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
      ] as ApiQueryKey;
    });
  }, [widget, organization, pageFilters, samplingMode]);

  // Use useApiQueries to fetch all queries in parallel
  return useApiQueries<SpansSeriesResponse>(queryKeys, {
    staleTime: 0,
    enabled,
    retry: false,
  });
}

/**
 * Hook for fetching Spans widget table data using React Query.
 * Handles all widget queries in parallel and returns raw API responses.
 * Transforms are applied by the widget config after data is fetched.
 */
export function useSpansTableQuery({
  widget,
  organization,
  pageFilters,
  enabled,
  samplingMode,
  cursor,
  limit,
}: WidgetQueryParams) {
  // Build query keys for all widget queries
  const queryKeys = useMemo(() => {
    return widget.queries.map(query => {
      const eventView = eventViewFromWidget('', query, pageFilters);

      const params: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(widget.displayType),
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
        params.sort = toArray(orderBy);
      }

      const queryParams = {
        ...eventView.generateQueryStringObject(),
        ...params,
        ...(samplingMode ? {sampling: samplingMode} : {}),
      };

      // Build the API query key for events endpoint
      return [
        `/organizations/${organization.slug}/events/`,
        {
          method: 'GET' as const,
          query: queryParams,
        },
      ] as ApiQueryKey;
    });
  }, [widget, organization, pageFilters, samplingMode, cursor, limit]);

  // Use useApiQueries to fetch all queries in parallel
  return useApiQueries<SpansTableResponse>(queryKeys, {
    staleTime: 0,
    enabled,
    retry: false,
  });
}

/**
 * Unified hook that routes to series or table query based on display type.
 */
export function useSpansWidgetQuery(params: WidgetQueryParams) {
  const isChart = isChartDisplayType(params.widget.displayType);

  // Call both hooks (hooks must be called unconditionally)
  const seriesResults = useSpansSeriesQuery({
    ...params,
    enabled: params.enabled && isChart,
  });
  const tableResults = useSpansTableQuery({
    ...params,
    enabled: params.enabled && !isChart,
  });

  // Return the appropriate results based on display type
  return isChart ? seriesResults : tableResults;
}
