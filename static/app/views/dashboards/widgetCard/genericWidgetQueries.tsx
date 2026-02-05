import {useEffect, useMemo, useRef} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import trimStart from 'lodash/trimStart';

import type {ResponseMeta} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {
  isAggregateField,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DEFAULT_TABLE_LIMIT, DisplayType} from 'sentry/views/dashboards/types';
import {
  dashboardFiltersToString,
  usesTimeSeriesData,
} from 'sentry/views/dashboards/utils';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';

export function getReferrer(displayType: DisplayType) {
  let referrer = '';

  if (displayType === DisplayType.TABLE) {
    referrer = 'api.dashboards.tablewidget';
  } else if (displayType === DisplayType.BIG_NUMBER) {
    referrer = 'api.dashboards.bignumberwidget';
  } else {
    referrer = `api.dashboards.widget.${displayType}-chart`;
  }

  return referrer;
}

export type OnDataFetchedProps = {
  confidence?: Confidence;
  isProgressivelyLoading?: boolean;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalIssuesCount?: string;
};

export type GenericWidgetQueriesResult = {
  loading: boolean;
  confidence?: Confidence;
  errorMessage?: string;
  isProgressivelyLoading?: boolean;
  isSampled?: boolean | null;
  pageLinks?: string;
  sampleCount?: number;
  tableResults?: TableDataWithTitle[];
  timeSeriesResults?: SeriesMap[];
  timeseriesResults?: Series[];
  timeseriesResultsTypes?: Record<string, AggregationOutputType>;
  timeseriesResultsUnits?: Record<string, DataUnit>;
  totalCount?: string;
};

/**
 * Result type for hook-based queries.
 */
export type HookWidgetQueryResult = GenericWidgetQueriesResult & {
  /**
   * Raw API response data, used for callbacks in genericWidgetQueries.tsx
   */
  rawData: any[];
};

export type UseGenericWidgetQueriesProps<SeriesResponse, TableResponse> = {
  config: DatasetConfig<SeriesResponse, TableResponse>;
  widget: Widget;
  afterFetchSeriesData?: (result: SeriesResponse) => void;
  afterFetchTableData?: (
    result: TableResponse,
    response?: ResponseMeta
  ) => void | {totalIssuesCount?: string};
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  disabled?: boolean;
  limit?: number;
  loading?: boolean;
  mepSetting?: MEPState | null;
  onDataFetchStart?: () => void;
  onDataFetched?: ({
    tableResults,
    timeseriesResults,
    totalIssuesCount,
    pageLinks,
    timeseriesResultsTypes,
  }: OnDataFetchedProps) => void;
  onDemandControlContext?: OnDemandControlContext;
  samplingMode?: SamplingMode;
  // Optional selection override - if not provided, usePageFilters hook will be used
  // This is needed for the widget viewer modal where local zoom state (modalSelection)
  // needs to override global PageFiltersStore
  selection?: PageFilters;
  // Skips adding parens before applying dashboard filters
  // Used for datasets that do not support parens/boolean logic
  skipDashboardFilterParens?: boolean;
};

/**
 * Creates a table widget variant for fetching breakdown totals.
 * Used when legendType is 'breakdown' to fetch aggregate values for the legend.
 */
function createBreakdownTableWidgetFromTimeSeriesWidget(widget: Widget): Widget {
  // rendering of the breakdown table assuming one query
  const queries = [];
  const firstQuery = widget.queries[0];

  if (firstQuery) {
    const aggregates = [...(firstQuery.aggregates ?? [])];
    const columns = [...(firstQuery.columns ?? [])];

    if (firstQuery.orderby) {
      // TODO: table requests uses `eventViewFromWidget`, which does not automatically add orderby's to the fields to prevent the error
      // `orderby must also be in the selected columns or groupby`
      const orderbyField = trimStart(firstQuery.orderby, '-');
      if (isAggregateField(orderbyField) && !aggregates.includes(orderbyField)) {
        aggregates.push(orderbyField);
      }
      if (!isAggregateField(orderbyField) && !columns.includes(orderbyField)) {
        columns.push(orderbyField);
      }
    }
    queries.push({
      ...firstQuery,
      fields: [...columns, ...aggregates],
      aggregates,
      columns,
    });
  }
  return {
    ...widget,
    displayType: DisplayType.TABLE,
    limit: widget.limit ?? TOP_N,
    queries,
  };
}

export function useGenericWidgetQueries<SeriesResponse, TableResponse>(
  props: UseGenericWidgetQueriesProps<SeriesResponse, TableResponse>
): GenericWidgetQueriesResult {
  const {
    config,
    widget,
    afterFetchSeriesData,
    afterFetchTableData,
    cursor,
    dashboardFilters,
    disabled,
    limit,
    loading: propsLoading,
    mepSetting,
    onDataFetchStart,
    onDataFetched,
    onDemandControlContext,
    samplingMode,
    selection: propsSelection,
    skipDashboardFilterParens,
  } = props;

  const organization = useOrganization();
  const hookPageFilters = usePageFilters();

  // Use override selection if provided (for modal zoom), otherwise use hook
  const selection = propsSelection ?? hookPageFilters.selection;

  const isTimeSeriesData = usesTimeSeriesData(widget.displayType);

  const enableSeriesHook = isTimeSeriesData && !disabled && !propsLoading;
  const enableTableHook = !isTimeSeriesData && !disabled && !propsLoading;
  const needsBreakdownTable = isTimeSeriesData && widget.legendType === 'breakdown';

  const tableWidget = useMemo(
    () =>
      needsBreakdownTable
        ? createBreakdownTableWidgetFromTimeSeriesWidget(widget)
        : widget,
    [needsBreakdownTable, widget]
  );

  const hookSeriesResults = config.useSeriesQuery?.({
    widget,
    organization,
    pageFilters: selection,
    dashboardFilters,
    skipDashboardFilterParens,
    onDemandControlContext,
    mepSetting,
    samplingMode,
    enabled: isTimeSeriesData && !disabled && !propsLoading,
    limit,
    cursor,
  });

  const hookTableResults = config.useTableQuery?.({
    widget: tableWidget,
    organization,
    pageFilters: selection,
    dashboardFilters,
    skipDashboardFilterParens,
    onDemandControlContext,
    mepSetting,
    samplingMode,
    enabled: enableTableHook || (enableSeriesHook && needsBreakdownTable),
    limit: limit ?? DEFAULT_TABLE_LIMIT,
    cursor,
  });

  const hookResults = isTimeSeriesData ? hookSeriesResults : hookTableResults;

  // Track previous raw data to detect when new data arrives
  const prevRawDataRef = useRef<any[] | undefined>(undefined);
  // Track previous loading state to detect when fetching starts
  const prevLoadingRef = useRef(false);

  // Call onDataFetchStart when loading begins
  useEffect(() => {
    const isLoadingNow = hookResults?.loading ?? false;

    // Detect transition from not loading to loading (fetch start)
    if (isLoadingNow && !prevLoadingRef.current) {
      onDataFetchStart?.();
    }

    prevLoadingRef.current = isLoadingNow;
  }, [hookResults?.loading, onDataFetchStart]);

  // Watch for when hook data changes and call callbacks
  useEffect(() => {
    if (!hookResults?.rawData) {
      return;
    }

    // Only process if this is new data (not initial mount)
    if (hookResults.rawData === prevRawDataRef.current) {
      return;
    }

    prevRawDataRef.current = hookResults.rawData;

    // Call afterFetch callbacks with raw data
    if (isTimeSeriesData) {
      hookResults.rawData.forEach((data: any) => {
        afterFetchSeriesData?.(data as SeriesResponse);
      });

      // Call onDataFetched with transformed results
      onDataFetched?.({
        timeseriesResults: (hookResults as any).timeseriesResults,
        timeseriesResultsTypes: (hookResults as any).timeseriesResultsTypes,
        timeseriesResultsUnits: (hookResults as any).timeseriesResultsUnits,
      });
    } else {
      // Collect any results from afterFetchTableData callbacks
      let mergedCallbackData = {};
      hookResults.rawData.forEach((data: any) => {
        const result = afterFetchTableData?.(data as TableResponse);
        if (result) {
          mergedCallbackData = {...mergedCallbackData, ...result};
        }
      });

      // Always call onDataFetched, merging any callback results
      onDataFetched?.({
        tableResults: (hookResults as any).tableResults,
        pageLinks: (hookResults as any).pageLinks,
        ...mergedCallbackData,
      });
    }
  }, [
    hookResults,
    isTimeSeriesData,
    afterFetchSeriesData,
    afterFetchTableData,
    onDataFetched,
  ]);

  // Return hook results, with a fallback for the loading state
  const baseResults = hookResults ?? {
    loading: true,
    rawData: [],
  };

  if (!needsBreakdownTable) {
    return baseResults;
  }

  return {
    ...baseResults,
    loading: baseResults.loading || (hookTableResults?.loading ?? false),
    tableResults: hookTableResults?.tableResults,
    errorMessage: baseResults.errorMessage || hookTableResults?.errorMessage || undefined,
  };
}

export function cleanWidgetForRequest(widget: Widget): Widget {
  const _widget = cloneDeep(widget);
  _widget.queries.forEach(query => {
    query.aggregates = query.aggregates.filter(field => !!field && field !== 'equation|');
    query.columns = query.columns.filter(field => !!field && field !== 'equation|');
  });

  return _widget;
}

/**
 * Helper to apply dashboard filters and clean widget for API request.
 */
export function applyDashboardFiltersToWidget(
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
        query.conditions = `${query.conditions} ${dashboardFilterConditions}`;
      }
    });

    processedWidget = filtered;
  }

  return cleanWidgetForRequest(processedWidget);
}
