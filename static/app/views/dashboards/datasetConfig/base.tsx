import trimStart from 'lodash/trimStart';

import type {Client, ResponseMeta} from 'sentry/api';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import type {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {
  AggregationOutputType,
  DataUnit,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {isEquation} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {
  DashboardFilters,
  DisplayType,
  Widget,
  WidgetQuery,
} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {getNumEquations} from 'sentry/views/dashboards/utils';
import type {HookWidgetQueryResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';

import {ErrorsConfig} from './errors';
import {ErrorsAndTransactionsConfig} from './errorsAndTransactions';
import {IssuesConfig} from './issues';
import {LogsConfig} from './logs';
import {ReleasesConfig} from './releases';
import {SpansConfig} from './spans';
import {TraceMetricsConfig} from './traceMetrics';
import {TransactionsConfig} from './transactions';

export type WidgetBuilderSearchBarProps = {
  getFilterWarning: ((key: string) => React.ReactNode) | undefined;
  onClose: (value: string, additionalSearchBarState: {validSearch: boolean}) => void;
  onSearch: (query: string) => void;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
  dataset?: DiscoverDatasets;
  disabled?: boolean;
  index?: number;
  portalTarget?: HTMLElement | null;
};

export type SearchBarDataProviderProps = {
  pageFilters: PageFilters;
  widgetQuery?: WidgetQuery;
};

export interface SearchBarData {
  getFilterKeySections: () => FilterKeySection[];
  getFilterKeys: () => TagCollection;
  getTagValues: GetTagValues;
}

/**
 * Parameters passed to hook-based query methods (useSeriesQuery/useTableQuery).
 * These hooks handle fetching data for all widget queries at once.
 */
export type WidgetQueryParams = {
  /**
   * Whether the queries should be enabled. Used for queue integration.
   */
  enabled: boolean;
  /**
   * The organization context.
   */
  organization: Organization;
  /**
   * Page filters (projects, environments, datetime).
   */
  pageFilters: PageFilters;
  /**
   * The widget configuration containing all queries.
   */
  widget: Widget;
  /**
   * Optional pagination cursor.
   */
  cursor?: string;
  /**
   * Dashboard-level filters to apply to queries.
   */
  dashboardFilters?: DashboardFilters;
  /**
   * Optional result limit.
   */
  limit?: number;
  /**
   * MEP (Metrics Enhanced Performance) setting.
   */
  mepSetting?: MEPState | null;
  /**
   * On-demand control context for query optimization.
   */
  onDemandControlContext?: OnDemandControlContext;
  /**
   * Sampling mode for the queries.
   */
  samplingMode?: SamplingMode;
  /**
   * Skip adding parentheses around widget conditions when applying dashboard filters.
   */
  skipDashboardFilterParens?: boolean;
};

export interface DatasetConfig<SeriesResponse, TableResponse> {
  /**
   * Dataset specific search bar for the 'Filter' step in the
   * widget builder.
   */
  SearchBar: (props: WidgetBuilderSearchBarProps) => React.JSX.Element;
  /**
   * Default field to add to the widget query when adding a new field.
   */
  defaultField: QueryFieldValue;
  /**
   * Default query to display when dataset is selected in the
   * Widget Builder.
   */
  defaultWidgetQuery: WidgetQuery;
  /**
   * Whether or not the current dataset supports adding equations.
   */
  enableEquations: boolean;
  /**
   * Field options to display in the Column selectors for
   * Table display type.
   */
  getTableFieldOptions: (
    organization: Organization,
    tags?: TagCollection,
    customMeasurements?: CustomMeasurementCollection,
    api?: Client,
    displayType?: DisplayType
  ) => Record<string, SelectValue<FieldValue>>;
  /**
   * List of supported display types for dataset.
   */
  supportedDisplayTypes: DisplayType[];
  /**
   * Transforms table API results into format that is used by
   * table and big number components.
   */
  transformTable: (
    data: TableResponse,
    widgetQuery: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters
  ) => TableData;
  /**
   * Default field to add to the widget query when adding a new field for series display type.
   */
  defaultSeriesField?: QueryFieldValue;
  /**
   * Default query to display when dataset is selected in the
   * Widget Builder for series display type. Currently only used
   * by the issues dataset.
   */
  defaultSeriesWidgetQuery?: WidgetQuery;
  /**
   * Configure enabling/disabling sort/direction options with an
   * optional message for why it is disabled.
   */
  disableSortOptions?: (widgetQuery: WidgetQuery) => {
    disableSort: boolean;
    disableSortDirection: boolean;
    disableSortReason?: string;
  };
  /**
   * Filter the options available to the parameters list
   * of an aggregate function in QueryField component on the
   * Widget Builder.
   */
  filterAggregateParams?: (
    option: FieldValueOption,
    fieldValue?: QueryFieldValue
  ) => boolean;
  /**
   * Refine the options available in the sort options for timeseries
   * displays on the 'Sort by' step of the Widget Builder.
   */
  filterSeriesSortOptions?: (
    columns: Set<string>
  ) => (option: FieldValueOption) => boolean;
  /**
   * Filter the primary options available in a table widget
   * columns on the Widget Builder.
   */
  filterTableOptions?: (option: FieldValueOption) => boolean;
  /**
   * Filter the options available to the parameters list
   * of an aggregate function in QueryField component on the
   * Widget Builder.
   */
  filterYAxisAggregateParams?: (
    fieldValue: QueryFieldValue,
    displayType: DisplayType
  ) => (option: FieldValueOption) => boolean;
  filterYAxisOptions?: (
    displayType: DisplayType
  ) => (option: FieldValueOption) => boolean;
  /**
   * Used to select custom renderers for field types.
   */
  getCustomFieldRenderer?: (
    field: string,
    meta: MetaType,
    widget?: Widget,
    organization?: Organization,
    dashboardFilters?: DashboardFilters
  ) => ReturnType<typeof getFieldRenderer>;
  /**
   * Generate field header used for mapping column
   * names to more desirable values in tables.
   */
  getFieldHeaderMap?: (widgetQuery?: WidgetQuery) => Record<string, string>;
  /**
   * Field options to display in the Group by selector.
   */
  getGroupByFieldOptions?: (
    organization: Organization,
    tags?: TagCollection,
    customMeasurements?: CustomMeasurementCollection,
    api?: Client,
    queries?: WidgetQuery[]
  ) => Record<string, SelectValue<FieldValue>>;
  /**
   * Generate the request promises for fetching
   * series data.
   */
  getSeriesRequest?: (
    api: Client,
    widget: Widget,
    queryIndex: number,
    organization: Organization,
    pageFilters: PageFilters,
    onDemandControlContext?: OnDemandControlContext,
    referrer?: string,
    mepSetting?: MEPState | null,
    samplingMode?: SamplingMode
  ) => Promise<[SeriesResponse, string | undefined, ResponseMeta | undefined]>;
  /**
   * Get the result type of the series. ie duration, size, percentage, etc
   */
  getSeriesResultType?: (
    data: SeriesResponse,
    widgetQuery: WidgetQuery
  ) => Record<string, AggregationOutputType>;
  /**
   * Get the result unit of the series. ie milliseconds, bytes, etc
   */
  getSeriesResultUnit?: (
    data: SeriesResponse,
    widgetQuery: WidgetQuery
  ) => Record<string, DataUnit>;
  /**
   * Generate the request promises for fetching
   * tabular data.
   */
  getTableRequest?: (
    api: Client,
    widget: Widget,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    onDemandControlContext?: OnDemandControlContext,
    limit?: number,
    cursor?: string,
    referrer?: string,
    mepSetting?: MEPState | null,
    samplingMode?: SamplingMode
  ) => Promise<[TableResponse, string | undefined, ResponseMeta | undefined]>;
  /**
   * Generate the list of sort options for table
   * displays on the 'Sort by' step of the Widget Builder.
   */
  getTableSortOptions?: (
    organization: Organization,
    widgetQuery: WidgetQuery
  ) => Array<SelectValue<string>>;
  /**
   * Generate the list of sort options for timeseries
   * displays on the 'Sort by' step of the Widget Builder.
   */
  getTimeseriesSortOptions?: (
    organization: Organization,
    widgetQuery: WidgetQuery,
    tags?: TagCollection
  ) => Record<string, SelectValue<FieldValue>>;
  /**
   * Apply dataset specific overrides to the logic that handles
   * column updates for tables in the Widget Builder.
   */
  handleColumnFieldChangeOverride?: (widgetQuery: WidgetQuery) => WidgetQuery;
  /**
   * Called on column or y-axis change in the Widget Builder
   * to reset the orderby of the widget query.
   */
  handleOrderByReset?: (widgetQuery: WidgetQuery, newFields: string[]) => WidgetQuery;
  /**
   * Transforms timeseries API results into series data that is
   * ingestable by echarts for timeseries visualizations.
   */
  transformSeries?: (
    data: SeriesResponse,
    widgetQuery: WidgetQuery,
    organization: Organization
  ) => Series[];
  /**
   * Data provider hook that provides methods
   * to retrieve tags and values for the search bar.
   */
  useSearchBarDataProvider?: (props: SearchBarDataProviderProps) => SearchBarData;

  /**
   * Hook-based approach for fetching series data
   * Queries are disabled by default - refetch() must be called to fetch.
   * Returns transformed data, raw responses for callbacks, and refetch function.
   * This replaces getSeriesRequest when available.
   */
  useSeriesQuery?: (params: WidgetQueryParams) => HookWidgetQueryResult;
  /**
   * Hook-based approach for fetching table data
   * Queries are disabled by default - refetch() must be called to fetch.
   * Returns transformed data, raw responses for callbacks, and refetch function.
   * This replaces getTableRequest when available.
   */
  useTableQuery?: (params: WidgetQueryParams) => HookWidgetQueryResult;
}

export function getDatasetConfig<T extends WidgetType | undefined>(
  widgetType: T
): T extends WidgetType.ISSUE
  ? typeof IssuesConfig
  : T extends WidgetType.RELEASE
    ? typeof ReleasesConfig
    : T extends WidgetType.ERRORS
      ? typeof ErrorsConfig
      : T extends WidgetType.TRANSACTIONS
        ? typeof TransactionsConfig
        : T extends WidgetType.LOGS
          ? typeof LogsConfig
          : T extends WidgetType.SPANS
            ? typeof SpansConfig
            : T extends WidgetType.TRACEMETRICS
              ? typeof TraceMetricsConfig
              : typeof ErrorsAndTransactionsConfig;

export function getDatasetConfig(
  widgetType?: WidgetType
):
  | typeof IssuesConfig
  | typeof ReleasesConfig
  | typeof ErrorsAndTransactionsConfig
  | typeof ErrorsConfig
  | typeof TransactionsConfig
  | typeof LogsConfig
  | typeof SpansConfig
  | typeof TraceMetricsConfig {
  switch (widgetType) {
    case WidgetType.ISSUE:
      return IssuesConfig;
    case WidgetType.RELEASE:
      return ReleasesConfig;
    case WidgetType.ERRORS:
      return ErrorsConfig;
    case WidgetType.TRANSACTIONS:
      return TransactionsConfig;
    case WidgetType.LOGS:
      return LogsConfig;
    case WidgetType.SPANS:
      return SpansConfig;
    case WidgetType.TRACEMETRICS:
      return TraceMetricsConfig;
    case WidgetType.DISCOVER:
    default:
      return ErrorsAndTransactionsConfig;
  }
}

/**
 * A generic orderby reset helper function that updates the query's
 * orderby based on new selected fields.
 */
export function handleOrderByReset(
  widgetQuery: WidgetQuery,
  newFields: string[]
): WidgetQuery {
  const rawOrderby = trimStart(widgetQuery.orderby, '-');
  const isDescending = widgetQuery.orderby.startsWith('-');
  const orderbyPrefix = isDescending ? '-' : '';

  if (!newFields.includes(rawOrderby) && widgetQuery.orderby !== '') {
    const isFromAggregates = widgetQuery.aggregates.includes(rawOrderby);
    const isCustomEquation = isEquation(rawOrderby);
    const isUsedInGrouping = widgetQuery.columns.includes(rawOrderby);

    const keepCurrentOrderby = isFromAggregates || isCustomEquation || isUsedInGrouping;
    const firstAggregateAlias = isEquation(widgetQuery.aggregates[0] ?? '')
      ? `equation[${getNumEquations(widgetQuery.aggregates) - 1}]`
      : newFields[0];

    widgetQuery.orderby =
      (keepCurrentOrderby && widgetQuery.orderby) ||
      `${orderbyPrefix}${firstAggregateAlias}`;
  }
  return widgetQuery;
}
