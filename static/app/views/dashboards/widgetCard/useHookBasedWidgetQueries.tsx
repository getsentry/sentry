import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import type {ResponseMeta} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DashboardFilters, Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';

import type {
  GenericWidgetQueriesResult,
  OnDataFetchedProps,
  UseGenericWidgetQueriesProps,
} from './genericWidgetQueries';

type UseHookBasedWidgetQueriesProps<SeriesResponse, TableResponse> = {
  config: DatasetConfig<SeriesResponse, TableResponse>;
  isChartDisplay: boolean;
  organization: any;
  pageFilters: PageFilters;
  props: UseGenericWidgetQueriesProps<SeriesResponse, TableResponse>;
  queue: any; // ReactAsyncQueuer from @tanstack/react-pacer
  selection: PageFilters;
  widget: Widget;
  afterFetchSeriesData?: (result: SeriesResponse) => void;
  afterFetchTableData?: (
    result: TableResponse,
    response?: ResponseMeta
  ) => void | {totalIssuesCount?: string};
  cursor?: string;
  customDidUpdateComparator?: (
    prevProps: UseGenericWidgetQueriesProps<SeriesResponse, TableResponse>,
    nextProps: UseGenericWidgetQueriesProps<SeriesResponse, TableResponse>
  ) => boolean;
  dashboardFilters?: DashboardFilters;
  disabled?: boolean;
  forceOnDemand?: boolean;
  limit?: number;
  mepSetting?: any;
  onDataFetchStart?: () => void;
  onDataFetched?: (props: OnDataFetchedProps) => void;
  onDemandControlContext?: any;
  propsLoading?: boolean;
  samplingMode?: any;
  skipDashboardFilterParens?: boolean;
};

/**
 * Hook-based implementation for widget queries using React Query.
 * This is used for datasets that have been migrated to the hook-based approach.
 */
export function useHookBasedWidgetQueries<SeriesResponse, TableResponse>({
  config,
  widget,
  selection,
  isChartDisplay,
  dashboardFilters,
  skipDashboardFilterParens,
  onDemandControlContext,
  mepSetting,
  samplingMode,
  disabled,
  limit,
  cursor,
  afterFetchSeriesData,
  afterFetchTableData,
  onDataFetched,
  onDataFetchStart,
  queue,
  propsLoading,
  customDidUpdateComparator,
  organization,
  props,
  forceOnDemand,
}: UseHookBasedWidgetQueriesProps<
  SeriesResponse,
  TableResponse
>): GenericWidgetQueriesResult {
  // Ref to store refetch function for queue integration
  const refetchRef = useRef<() => Promise<void>>(async () => {});
  // Track if we've started fetching (for loading state)
  const [hasFetched, setHasFetched] = useState(false);

  // Helper to apply dashboard filters
  const applyDashboardFilters = useCallback(
    (widgetToFilter: Widget): Widget => {
      const dashboardFilterConditions = dashboardFiltersToString(
        dashboardFilters,
        widgetToFilter.widgetType
      );
      widgetToFilter.queries.forEach(query => {
        if (dashboardFilterConditions) {
          // If there is no base query, there's no need to add parens
          if (query.conditions && !skipDashboardFilterParens) {
            query.conditions = `(${query.conditions})`;
          }
          query.conditions = query.conditions + ` ${dashboardFilterConditions}`;
        }
      });
      return widgetToFilter;
    },
    [dashboardFilters, skipDashboardFilterParens]
  );

  // Apply dashboard filters to the widget before passing to hook
  const transformedWidget = useMemo(() => {
    return applyDashboardFilters(cloneDeep(widget));
  }, [widget, applyDashboardFilters]);

  // Build query params for the hook
  const queryParams = useMemo(
    () => ({
      widget: transformedWidget,
      organization,
      pageFilters: selection,
      dashboardFilters,
      onDemandControlContext,
      mepSetting,
      samplingMode,
      enabled: false, // Disable automatic fetching - we'll use refetch() instead
      limit,
      cursor,
    }),
    [
      transformedWidget,
      organization,
      selection,
      dashboardFilters,
      onDemandControlContext,
      mepSetting,
      samplingMode,
      limit,
      cursor,
    ]
  );

  // Call both hooks unconditionally (hooks must be called in the same order every render)
  // Both are disabled - we'll use refetch() to trigger fetches manually
  const seriesQueryResults =
    config.useSeriesQuery?.({
      ...queryParams,
      enabled: false, // Will be manually refetched
    }) ?? [];
  const tableQueryResults =
    config.useTableQuery?.({
      ...queryParams,
      enabled: false, // Will be manually refetched
    }) ?? [];

  // Use the appropriate results based on display type
  const queryResults = isChartDisplay ? seriesQueryResults : tableQueryResults;

  // Update refetch ref with the current refetch functions
  useEffect(() => {
    refetchRef.current = async () => {
      if (disabled) {
        return;
      }
      setHasFetched(true);
      // Refetch all queries in parallel
      await Promise.all(queryResults.map(q => q.refetch()));
    };
  }, [queryResults, disabled]);

  // Aggregate loading and error states
  const isLoading = queryResults.some(q => q.isLoading);
  const hookErrorMessage = queryResults.find(q => q.error)?.error?.message;

  // Transform data after all queries succeed
  const transformedData = useMemo(() => {
    const allSuccessful = queryResults.every(q => q.isSuccess);
    if (!allSuccessful) {
      return {
        timeseriesResults: undefined,
        tableResults: undefined,
        pageLinks: undefined,
        timeseriesResultsTypes: undefined,
        timeseriesResultsUnits: undefined,
      };
    }

    if (isChartDisplay) {
      // Transform series data
      const timeseriesResults: Series[] = [];
      let timeseriesResultsTypes: Record<string, AggregationOutputType> = {};
      let timeseriesResultsUnits: Record<string, DataUnit> = {};

      queryResults.forEach((q, requestIndex) => {
        if (!q || !q.data) {
          return;
        }

        // Call afterFetch callback
        afterFetchSeriesData?.(q.data as SeriesResponse);

        // Transform the data
        const transformedResult = config.transformSeries!(
          q.data as SeriesResponse,
          widget.queries[requestIndex]!,
          organization
        );

        // Maintain color consistency (same logic as old approach)
        transformedResult.forEach((result, resultIndex) => {
          timeseriesResults[requestIndex * transformedResult.length + resultIndex] =
            result;
        });

        // Get result types and units
        widget.queries.forEach(query => {
          timeseriesResultsTypes = {
            ...timeseriesResultsTypes,
            ...config.getSeriesResultType?.(q.data as SeriesResponse, query),
          };
          timeseriesResultsUnits = {
            ...timeseriesResultsUnits,
            ...config.getSeriesResultUnit?.(q.data as SeriesResponse, query),
          };
        });
      });

      return {
        timeseriesResults,
        timeseriesResultsTypes,
        timeseriesResultsUnits,
        tableResults: undefined,
        pageLinks: undefined,
      };
    }

    // Transform table data
    const tableResults: TableDataWithTitle[] = [];
    let responsePageLinks: string | undefined;
    let afterTableFetchData: OnDataFetchedProps | undefined;

    queryResults.forEach((q, i) => {
      if (!q || !q.data) {
        return;
      }

      // Call afterFetch callback
      afterTableFetchData = afterFetchTableData?.(q.data as TableResponse) ?? {};

      // Transform the data
      const transformedDataItem = config.transformTable(
        q.data as TableResponse,
        widget.queries[0]!,
        organization,
        selection
      ) as TableDataWithTitle;
      transformedDataItem.title = widget.queries[i]?.name ?? '';

      // Apply field meta if available
      const meta = transformedDataItem.meta;
      const fieldMeta = widget.queries?.[i]?.fieldMeta;
      if (fieldMeta && meta) {
        fieldMeta.forEach((m, index) => {
          const field = widget.queries?.[i]?.fields?.[index];
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
      timeseriesResults: undefined,
      tableResults,
      pageLinks: responsePageLinks,
      timeseriesResultsTypes: undefined,
      timeseriesResultsUnits: undefined,
      ...afterTableFetchData,
    };
  }, [
    queryResults,
    config,
    widget,
    organization,
    selection,
    isChartDisplay,
    afterFetchSeriesData,
    afterFetchTableData,
  ]);

  // Call onDataFetched when data is ready
  useEffect(() => {
    if (queryResults.every(q => q.isSuccess)) {
      onDataFetched?.(transformedData as OnDataFetchedProps);
    }
  }, [queryResults, transformedData, onDataFetched]);

  // Queue integration for initial fetch
  const hasInitialFetchRef = useRef(false);
  useEffect(() => {
    if (!hasInitialFetchRef.current && !propsLoading) {
      hasInitialFetchRef.current = true;
      if (queue) {
        queue.addItem({fetchDataRef: refetchRef});
      } else {
        refetchRef.current();
      }
    }
  }, [queue, propsLoading]);

  // Refetch when dependencies change
  const prevPropsRef = useRef<
    UseGenericWidgetQueriesProps<SeriesResponse, TableResponse> | undefined
  >(undefined);
  const prevSelectionRef = useRef(selection);

  useEffect(() => {
    const prevProps = prevPropsRef.current;
    if (!prevProps || !hasInitialFetchRef.current) {
      prevPropsRef.current = props;
      prevSelectionRef.current = selection;
      return;
    }

    // Same change detection logic as old approach
    const previousQueries = prevProps.widget.queries;
    const [_prevNames, prevWidgetQueries] = previousQueries.reduce(
      (
        [names, queries]: [string[], Array<Omit<WidgetQuery, 'name'>>],
        {name, ...rest}
      ) => {
        names.push(name);
        rest.fields = rest.fields?.filter(field => !!field) ?? [];
        rest = omit(rest, 'fieldAliases');
        queries.push(rest);
        return [names, queries];
      },
      [[], []]
    );

    const nextQueries = widget.queries;
    const [_names, widgetQueries] = nextQueries.reduce(
      (
        [names, queries]: [string[], Array<Omit<WidgetQuery, 'name'>>],
        {name, ...rest}
      ) => {
        names.push(name);
        rest.fields = rest.fields?.filter(field => !!field) ?? [];
        rest = omit(rest, 'fieldAliases');
        queries.push(rest);
        return [names, queries];
      },
      [[], []]
    );

    if (
      customDidUpdateComparator
        ? customDidUpdateComparator(prevProps, props)
        : widget.limit !== prevProps.widget.limit ||
          !isEqual(widget.widgetType, prevProps.widget.widgetType) ||
          !isEqual(widget.displayType, prevProps.widget.displayType) ||
          !isEqual(widget.interval, prevProps.widget.interval) ||
          !isEqual(new Set(widgetQueries), new Set(prevWidgetQueries)) ||
          !isEqual(dashboardFilters, prevProps.dashboardFilters) ||
          !isEqual(forceOnDemand, prevProps.forceOnDemand) ||
          !isEqual(disabled, prevProps.disabled) ||
          !isSelectionEqual(selection, prevSelectionRef.current) ||
          cursor !== prevProps.cursor
    ) {
      // Need to refetch
      if (queue) {
        queue.addItem({fetchDataRef: refetchRef});
      } else {
        refetchRef.current();
      }
      prevPropsRef.current = props;
      prevSelectionRef.current = selection;
    }
  }, [
    widget,
    selection,
    cursor,
    customDidUpdateComparator,
    dashboardFilters,
    forceOnDemand,
    disabled,
    queue,
    props,
  ]);

  // Call onDataFetchStart when queries start
  useEffect(() => {
    if (isLoading) {
      onDataFetchStart?.();
    }
  }, [isLoading, onDataFetchStart]);

  return {
    loading: isLoading || propsLoading || !hasFetched,
    errorMessage: hookErrorMessage,
    ...transformedData,
  };
}
