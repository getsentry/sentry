import {useMemo, useRef} from 'react';
import {keepPreviousData, queryOptions, useQueries} from '@tanstack/react-query';
import trimStart from 'lodash/trimStart';

import type {Series} from 'sentry/types/echarts';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import {apiFetch, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {toArray} from 'sentry/utils/array/toArray';
import {getUtcDateString} from 'sentry/utils/dates';
import type {
  EventsTableData,
  TableData,
  TableDataWithTitle,
} from 'sentry/utils/discover/discoverQuery';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import {
  getEquationAliasIndex,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SERIES_QUERY_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import type {WidgetQueryParams} from 'sentry/views/dashboards/datasetConfig/base';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {Widget} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {getSeriesQueryPrefix} from 'sentry/views/dashboards/utils/getSeriesQueryPrefix';
import {useWidgetQueryQueue} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {
  applyDashboardFiltersToWidget,
  getReferrer,
} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import {getWidgetStaleTime} from 'sentry/views/dashboards/widgetCard/hooks/utils/getStaleTime';
import {
  getConditionalFilterInvalidSeriesMessageForAggregates,
  getValidAggregatesForRequest,
  hasNoValidAggregatesForRequest,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {STARRED_SEGMENT_TABLE_QUERY_KEY} from 'sentry/views/insights/common/components/tableCells/starredSegmentCell';
import {getRetryDelay} from 'sentry/views/insights/common/utils/retryHandlers';
import {SpanFields} from 'sentry/views/insights/types';

type SpansSeriesResponse =
  | EventsStats
  | MultiSeriesEventsStats
  | GroupedMultiSeriesEventsStats;
type SpansTableResponse = TableData | EventsTableData;

/**
 * Hook for fetching Spans widget series data (charts) using React Query.
 * Queries are disabled by default - use refetch() to trigger fetching.
 * This allows genericWidgetQueries to control timing with queue/callbacks.
 */
// Stable empty array to prevent infinite rerenders
const EMPTY_ARRAY: any[] = [];

function isOrderbyValidForAggregates(
  orderby: string,
  validAggregates: readonly string[],
  columns: readonly string[]
): boolean {
  const orderbyField = trimStart(orderby, '-');
  if (!orderbyField) {
    return true;
  }
  if (validAggregates.includes(orderbyField) || columns.includes(orderbyField)) {
    return true;
  }
  if (isEquationAlias(orderbyField)) {
    return (
      getEquationAliasIndex(orderbyField) < validAggregates.filter(isEquation).length
    );
  }
  return false;
}

function keepAlignedValues<T>(
  values: readonly T[] | undefined,
  keep: readonly boolean[]
): T[] | undefined {
  if (values === undefined) {
    return undefined;
  }
  return keep.flatMap((kept, index) => {
    if (!kept || index >= values.length) {
      return [];
    }
    return [values[index]!];
  });
}

/**
 * Drop invalid Explore-style `_if` aggregates before building a series/table
 * request. Also retarget `orderby` when it pointed at a removed series so
 * getSeriesRequestData does not re-inject the invalid field.
 *
 * `fields`, `fieldAliases`, and `fieldMeta` are parallel arrays. Strip with the
 * same keep-mask so table/series transforms do not zip leftover meta onto the
 * wrong remaining field.
 */
function withValidConditionalAggregates(widget: Widget, queryIndex: number): Widget {
  const query = widget.queries[queryIndex];
  if (!query) {
    return widget;
  }
  const aggregates = query.aggregates ?? [];
  const validAggregates = getValidAggregatesForRequest(aggregates);
  if (validAggregates.length === aggregates.length) {
    return widget;
  }

  const columns = query.columns ?? [];
  let nextOrderby = query.orderby ?? '';
  if (!isOrderbyValidForAggregates(nextOrderby, validAggregates, columns)) {
    const fallback = validAggregates[0];
    if (!fallback) {
      nextOrderby = '';
    } else if (query.orderby?.startsWith('-')) {
      nextOrderby = `-${fallback}`;
    } else {
      nextOrderby = fallback;
    }
  }

  const validAggregateSet = new Set(validAggregates);
  const columnSet = new Set(columns);
  const originalFields = query.fields ?? [...columns, ...aggregates];
  const keep = originalFields.map(
    field => columnSet.has(field) || validAggregateSet.has(field)
  );

  return {
    ...widget,
    queries: widget.queries.map((widgetQuery, index) => {
      if (index !== queryIndex) {
        return widgetQuery;
      }
      return {
        ...widgetQuery,
        aggregates: validAggregates,
        orderby: nextOrderby,
        fields: widgetQuery.fields
          ? originalFields.filter((_, fieldIndex) => keep[fieldIndex])
          : widgetQuery.fields,
        fieldAliases: keepAlignedValues(widgetQuery.fieldAliases, keep),
        fieldMeta: keepAlignedValues(widgetQuery.fieldMeta, keep),
      };
    }),
  };
}

export function useSpansSeriesQuery(
  params: WidgetQueryParams & {skipDashboardFilterParens?: boolean}
): HookWidgetQueryResult {
  const {
    widget,
    organization,
    pageFilters,
    enabled, // Enabled by default - React Query auto-fetches when keys change
    samplingMode,
    dashboardFilters,
    skipDashboardFilterParens,
    widgetInterval,
  } = params;

  const {queue} = useWidgetQueryQueue();
  // Cache the previous rawData array to prevent unnecessary rerenders
  const prevRawDataRef = useRef<SpansSeriesResponse[] | undefined>(undefined);
  const hasConditionalAggregates = organization.features.includes(
    'explore-conditional-aggregates'
  );

  // Apply dashboard filters
  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const skippedConditionalFilterQueryIndexes = useMemo(
    () =>
      hasConditionalAggregates
        ? filteredWidget.queries
            .map((query, index) =>
              hasNoValidAggregatesForRequest(query.aggregates ?? []) ? index : null
            )
            .filter((index): index is number => index !== null)
        : [],
    [filteredWidget.queries, hasConditionalAggregates]
  );

  const allQueriesSkippedForConditionalFilter =
    filteredWidget.queries.length > 0 &&
    skippedConditionalFilterQueryIndexes.length === filteredWidget.queries.length;

  const queryResults = useQueries({
    queries: filteredWidget.queries.map((_, queryIndex) => {
      const aggregates = filteredWidget.queries[queryIndex]!.aggregates ?? [];
      const skippedForInvalidConditionalFilter =
        hasConditionalAggregates && hasNoValidAggregatesForRequest(aggregates);
      const widgetForRequest = hasConditionalAggregates
        ? withValidConditionalAggregates(filteredWidget, queryIndex)
        : filteredWidget;

      const requestData = getSeriesRequestData(
        widgetForRequest,
        queryIndex,
        organization,
        pageFilters,
        DiscoverDatasets.SPANS,
        getReferrer(filteredWidget.displayType),
        widgetInterval
      );

      // Add sampling mode if provided
      if (samplingMode) {
        requestData.sampling = samplingMode;
      }

      // Transform requestData into proper query params
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

      if (queryParams.start) {
        queryParams.start = getUtcDateString(queryParams.start);
      }
      if (queryParams.end) {
        queryParams.end = getUtcDateString(queryParams.end);
      }

      return queryOptions({
        ...apiOptions.as<SpansSeriesResponse>()(
          '/organizations/$organizationIdOrSlug/events-stats/',
          {
            path: {organizationIdOrSlug: organization.slug},
            method: 'GET' as const,
            query: queryParams,
            staleTime: getWidgetStaleTime(pageFilters),
          }
        ),
        queryFn: (context): Promise<ApiResponse<SpansSeriesResponse>> => {
          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<SpansSeriesResponse>(context).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<SpansSeriesResponse>(context);
        },
        enabled: enabled && !skippedForInvalidConditionalFilter,
        retry: false,
        retryDelay: getRetryDelay,
        placeholderData: keepPreviousData,
      });
    }),
  });

  const transformedData = (() => {
    if (allQueriesSkippedForConditionalFilter) {
      return {
        loading: false,
        errorMessage: getConditionalFilterInvalidSeriesMessageForAggregates(
          filteredWidget.queries[0]!.aggregates ?? []
        ),
        rawData: EMPTY_ARRAY,
      };
    }

    const activeQueryIndexes = filteredWidget.queries
      .map((_, index) => index)
      .filter(index => !skippedConditionalFilterQueryIndexes.includes(index));

    const isFetching = activeQueryIndexes.some(index => queryResults[index]?.isFetching);
    const allHaveData = activeQueryIndexes.every(index => queryResults[index]?.data);
    const errorMessage = activeQueryIndexes
      .map(index => queryResults[index]?.error?.message)
      .find(Boolean);

    if (!allHaveData || isFetching) {
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const timeseriesResults: Series[] = [];
    const timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
    const timeseriesResultsUnits: Record<string, DataUnit> = {};
    const rawData: SpansSeriesResponse[] = [];

    // Iterate active queries only and append densely so skipped invalid-_if
    // queries do not leave undefined holes in series/raw arrays (charts map
    // these by index; table results already use push).
    activeQueryIndexes.forEach(requestIndex => {
      const q = queryResults[requestIndex];
      if (!q?.data) {
        return;
      }

      const responseData = q.data;

      rawData.push(responseData);

      const queryForTransform = (
        hasConditionalAggregates
          ? withValidConditionalAggregates(filteredWidget, requestIndex)
          : filteredWidget
      ).queries[requestIndex]!;

      const transformedResult = SpansConfig.transformSeries!(
        responseData,
        queryForTransform,
        organization
      );
      const seriesQueryPrefix = getSeriesQueryPrefix(queryForTransform, filteredWidget);

      transformedResult.forEach((result: Series) => {
        if (seriesQueryPrefix) {
          result.seriesName = `${seriesQueryPrefix}${SERIES_QUERY_DELIMITER}${result.seriesName}`;
        }
        timeseriesResults.push(result);
      });

      // Get result types and units from config
      const resultTypes = SpansConfig.getSeriesResultType?.(
        responseData,
        queryForTransform
      );
      const resultUnits = SpansConfig.getSeriesResultUnit?.(
        responseData,
        queryForTransform
      );

      if (resultTypes) {
        Object.assign(timeseriesResultsTypes, resultTypes);
      }
      if (resultUnits) {
        Object.assign(timeseriesResultsUnits, resultUnits);
      }
    });

    // Check if rawData is the same as before to prevent unnecessary rerenders
    let finalRawData = rawData;
    if (prevRawDataRef.current?.length === rawData.length) {
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
    };
  })();

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
    enabled,
    samplingMode,
    cursor,
    limit,
    dashboardFilters,
    skipDashboardFilterParens,
  } = params;

  const {queue} = useWidgetQueryQueue();

  const prevRawDataRef = useRef<SpansTableResponse[] | undefined>(undefined);
  const hasConditionalAggregates = organization.features.includes(
    'explore-conditional-aggregates'
  );
  const filteredWidget = useMemo(
    () =>
      applyDashboardFiltersToWidget(widget, dashboardFilters, skipDashboardFilterParens),
    [widget, dashboardFilters, skipDashboardFilterParens]
  );

  const skippedConditionalFilterQueryIndexes = useMemo(
    () =>
      hasConditionalAggregates
        ? filteredWidget.queries
            .map((query, index) =>
              hasNoValidAggregatesForRequest(query.aggregates ?? []) ? index : null
            )
            .filter((index): index is number => index !== null)
        : [],
    [filteredWidget.queries, hasConditionalAggregates]
  );

  const allQueriesSkippedForConditionalFilter =
    filteredWidget.queries.length > 0 &&
    skippedConditionalFilterQueryIndexes.length === filteredWidget.queries.length;

  // Use native useQueries with queue-integrated queryFn
  // React Query auto-refetches when keys change, but API calls go through the queue
  const queryResults = useQueries({
    queries: filteredWidget.queries.map((_, queryIndex) => {
      const aggregates = filteredWidget.queries[queryIndex]!.aggregates ?? [];
      const skippedForInvalidConditionalFilter =
        hasConditionalAggregates && hasNoValidAggregatesForRequest(aggregates);
      const widgetForRequest = hasConditionalAggregates
        ? withValidConditionalAggregates(filteredWidget, queryIndex)
        : filteredWidget;
      const query = widgetForRequest.queries[queryIndex]!;

      const eventView = eventViewFromWidget('', query, pageFilters);

      const requestParams: DiscoverQueryRequestParams = {
        per_page: limit,
        cursor,
        referrer: getReferrer(filteredWidget.displayType),
        dataset: DiscoverDatasets.SPANS,
      };

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

      // Always sort by is_starred_transaction first if it's in the fields
      const existingSort = requestParams.sort || [];
      const hasStarredField = query.fields?.includes(SpanFields.IS_STARRED_TRANSACTION);

      const alreadySortedByStarred = Array.isArray(existingSort)
        ? existingSort.some(sort => sort.includes(SpanFields.IS_STARRED_TRANSACTION))
        : existingSort.includes(SpanFields.IS_STARRED_TRANSACTION);

      if (hasStarredField && !alreadySortedByStarred) {
        requestParams.sort = [
          encodeSort({field: SpanFields.IS_STARRED_TRANSACTION, kind: 'desc'}),
          ...existingSort,
        ];
      }

      const queryParams = {
        ...eventView.generateQueryStringObject(),
        ...requestParams,
        ...(samplingMode ? {sampling: samplingMode} : {}),
      };

      const baseOptions = apiOptions.as<SpansTableResponse>()(
        '/organizations/$organizationIdOrSlug/events/',
        {
          path: {organizationIdOrSlug: organization.slug},
          method: 'GET' as const,
          query: queryParams,
          staleTime: getWidgetStaleTime(pageFilters),
        }
      );

      // eslint-disable-next-line @tanstack/query/exhaustive-deps
      return queryOptions({
        ...baseOptions,
        queryKey: [...STARRED_SEGMENT_TABLE_QUERY_KEY, ...baseOptions.queryKey] as never,
        queryFn: (context): Promise<ApiResponse<SpansTableResponse>> => {
          const modifiedContext = {
            ...context,
            // remove the STARRED_SEGMENT_TABLE_QUERY_KEY prefix, it's only used for the cache key, not the api call
            queryKey: baseOptions.queryKey,
          };

          if (queue) {
            return new Promise((resolve, reject) => {
              const fetchFnRef = {
                current: () =>
                  apiFetch<SpansTableResponse>(modifiedContext).then(resolve, reject),
              };
              queue.addItem({fetchDataRef: fetchFnRef});
            });
          }
          return apiFetch<SpansTableResponse>(modifiedContext);
        },
        enabled: enabled && !skippedForInvalidConditionalFilter,
        retry: false,
        retryDelay: getRetryDelay,
        select: selectJsonWithHeaders,
      });
    }),
  });

  const transformedData = (() => {
    if (allQueriesSkippedForConditionalFilter) {
      return {
        loading: false,
        errorMessage: getConditionalFilterInvalidSeriesMessageForAggregates(
          filteredWidget.queries[0]!.aggregates ?? []
        ),
        rawData: EMPTY_ARRAY,
      };
    }

    const activeQueryIndexes = filteredWidget.queries
      .map((_, index) => index)
      .filter(index => !skippedConditionalFilterQueryIndexes.includes(index));

    const isFetching = activeQueryIndexes.some(index => queryResults[index]?.isFetching);
    const allHaveData = activeQueryIndexes.every(
      index => queryResults[index]?.data?.json
    );
    const errorMessage = activeQueryIndexes
      .map(index => queryResults[index]?.error?.message)
      .find(Boolean);

    if (!allHaveData || isFetching) {
      // If there's an error and we're not fetching, we're done loading
      const loading = isFetching || !errorMessage;
      return {
        loading,
        errorMessage,
        rawData: EMPTY_ARRAY,
      };
    }

    const tableResults: TableDataWithTitle[] = [];
    const rawData: SpansTableResponse[] = [];
    let responsePageLinks: string | undefined;

    activeQueryIndexes.forEach(i => {
      const q = queryResults[i];
      if (!q?.data?.json) {
        return;
      }

      const responseData = q.data.json;
      rawData.push(responseData);

      const queryForTransform = (
        hasConditionalAggregates
          ? withValidConditionalAggregates(filteredWidget, i)
          : filteredWidget
      ).queries[i]!;

      const transformedDataItem: TableDataWithTitle = {
        ...SpansConfig.transformTable(
          responseData,
          queryForTransform,
          organization,
          pageFilters
        ),
        title: queryForTransform.name ?? '',
      };

      const meta = transformedDataItem.meta;
      const fieldMeta = queryForTransform.fieldMeta;
      if (fieldMeta && meta) {
        const units = (meta.units ??= {});
        const fields = (meta.fields ??= {});
        fieldMeta.forEach((m, index) => {
          const field = queryForTransform.fields?.[index];
          if (m && field) {
            units[field] = m.valueUnit ?? '';
            fields[field] = m.valueType;
          }
        });
      }

      tableResults.push(transformedDataItem);

      // Get page links from response meta
      responsePageLinks = q.data.headers.Link;
    });

    // Check if rawData is the same as before to prevent unnecessary rerenders
    // Compare each data object reference - if they're all the same, reuse previous array
    let finalRawData = rawData;
    if (prevRawDataRef.current?.length === rawData.length) {
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
