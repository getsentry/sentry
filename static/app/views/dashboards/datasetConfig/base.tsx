import trimStart from 'lodash/trimStart';

import {Client, ResponseMeta} from 'sentry/api';
import {SearchBarProps} from 'sentry/components/events/searchBar';
import {Organization, PageFilters, SelectValue, TagCollection} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  AggregationOutputType,
  isEquation,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValue} from 'sentry/views/discover/table/types';

import {DisplayType, Widget, WidgetQuery, WidgetType} from '../types';
import {getNumEquations} from '../utils';

import {ErrorsAndTransactionsConfig} from './errorsAndTransactions';
import {IssuesConfig} from './issues';
import {ReleasesConfig} from './releases';

export type WidgetBuilderSearchBarProps = {
  onClose: SearchBarProps['onClose'];
  onSearch: SearchBarProps['onSearch'];
  organization: Organization;
  pageFilters: PageFilters;
  widgetQuery: WidgetQuery;
};

export interface DatasetConfig<SeriesResponse, TableResponse> {
  /**
   * Dataset specific search bar for the 'Filter' step in the
   * widget builder.
   */
  SearchBar: (props: WidgetBuilderSearchBarProps) => JSX.Element;
  /**
   * Default query to display when dataset is selected in the
   * Widget Builder.
   */
  defaultWidgetQuery: WidgetQuery;
  enableEquations: boolean;
  /**
   * Field options to display in the Column selectors for
   * Table display type.
   */
  getTableFieldOptions: (
    organization: Organization,
    tags?: TagCollection,
    customMeasurements?: CustomMeasurementCollection
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
   * Configure enabling/disabling sort/direction options with an
   * optional message for why it is disabled.
   */
  disableSortOptions?: (widgetQuery: WidgetQuery) => {
    disableSort: boolean;
    disableSortDirection: boolean;
    disableSortReason?: string;
  };
  /**
   * Used for mapping column names to more desirable
   * values in tables.
   */
  fieldHeaderMap?: Record<string, string>;
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
    organization?: Organization
  ) => ReturnType<typeof getFieldRenderer> | null;
  /**
   * Field options to display in the Group by selector.
   */
  getGroupByFieldOptions?: (
    organization: Organization,
    tags?: TagCollection
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
    referrer?: string,
    mepSetting?: MEPState | null
  ) => Promise<[SeriesResponse, string | undefined, ResponseMeta | undefined]>;
  /**
   * Get the result type of the series. ie duration, size, percentage, etc
   */
  getSeriesResultType?: (
    data: SeriesResponse,
    widgetQuery: WidgetQuery
  ) => Record<string, AggregationOutputType>;
  /**
   * Generate the request promises for fetching
   * tabular data.
   */
  getTableRequest?: (
    api: Client,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    limit?: number,
    cursor?: string,
    referrer?: string,
    mepSetting?: MEPState | null
  ) => Promise<[TableResponse, string | undefined, ResponseMeta | undefined]>;
  /**
   * Generate the list of sort options for table
   * displays on the 'Sort by' step of the Widget Builder.
   */
  getTableSortOptions?: (
    organization: Organization,
    widgetQuery: WidgetQuery
  ) => SelectValue<string>[];
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
   * Generate the request promises for fetching
   * world map data.
   */
  getWorldMapRequest?: (
    api: Client,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    limit?: number,
    cursor?: string,
    referrer?: string
  ) => ReturnType<Client['requestPromise']>;
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
}

export function getDatasetConfig<T extends WidgetType | undefined>(
  widgetType: T
): T extends WidgetType.ISSUE
  ? typeof IssuesConfig
  : T extends WidgetType.RELEASE
  ? typeof ReleasesConfig
  : typeof ErrorsAndTransactionsConfig;

export function getDatasetConfig(
  widgetType?: WidgetType
): typeof IssuesConfig | typeof ReleasesConfig | typeof ErrorsAndTransactionsConfig {
  switch (widgetType) {
    case WidgetType.ISSUE:
      return IssuesConfig;
    case WidgetType.RELEASE:
      return ReleasesConfig;
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
