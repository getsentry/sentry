import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {
  getAggregations,
  SPAN_OP_BREAKDOWN_FIELDS,
  TRANSACTION_FIELDS,
  TRANSACTIONS_AGGREGATION_FUNCTIONS,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey} from 'sentry/utils/fields';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {EventsSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';
import {
  useTransactionsSeriesQuery,
  useTransactionsTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useTransactionsWidgetQuery';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import {handleOrderByReset, type DatasetConfig} from './base';
import {
  filterAggregateParams,
  filterSeriesSortOptions,
  filterYAxisAggregateParams,
  filterYAxisOptions,
  getCustomEventsFieldRenderer,
  getTableSortOptions,
  getTimeseriesSortOptions,
  transformEventsResponseToTable,
} from './errorsAndTransactions';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count_unique(user)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count_unique(user)'],
  conditions: '',
  orderby: '-count_unique(user)',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['count_unique', 'user', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

export const TransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultCategoryField: 'transaction',
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: true,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  SearchBar: EventsSearchBar,
  filterSeriesSortOptions,
  filterYAxisAggregateParams,
  filterYAxisOptions,
  getTableFieldOptions: getEventsTableFieldOptions,
  getTimeseriesSortOptions,
  getTableSortOptions,
  getGroupByFieldOptions: getEventsTableFieldOptions,
  handleOrderByReset,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.BIG_NUMBER,
    DisplayType.CATEGORICAL_BAR,
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
  ],
  useSeriesQuery: useTransactionsSeriesQuery,
  useTableQuery: useTransactionsTableQuery,
  transformSeries: transformEventsResponseToSeries,
  transformTable: transformEventsResponseToTable,
  filterAggregateParams,
};

function getEventsTableFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
) {
  const measurements = getMeasurements();
  const aggregates = getAggregations(DiscoverDatasets.TRANSACTIONS);

  return generateFieldOptions({
    organization,
    tagKeys: Object.values(tags ?? {}).map(({key}) => key),
    measurementKeys: Object.values(measurements).map(({key}) => key),
    spanOperationBreakdownKeys: SPAN_OP_BREAKDOWN_FIELDS,
    customMeasurements: Object.values(customMeasurements ?? {}).map(
      ({key, functions}) => ({
        key,
        functions,
      })
    ),
    aggregations: Object.keys(aggregates)
      .filter(key => TRANSACTIONS_AGGREGATION_FUNCTIONS.includes(key as AggregationKey))
      .reduce((obj, key) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        obj[key] = aggregates[key];
        return obj;
      }, {}),
    fieldKeys: TRANSACTION_FIELDS,
  });
}
