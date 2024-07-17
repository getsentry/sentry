import type {Client} from 'sentry/api';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  PageFilters,
  TagCollection,
} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {SPAN_OP_BREAKDOWN_FIELDS, TRANSACTION_FIELDS} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import type {Widget, WidgetQuery} from '../types';
import {DisplayType} from '../types';
import {eventViewFromWidget} from '../utils';
import {EventsSearchBar} from '../widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';

import {type DatasetConfig, handleOrderByReset} from './base';
import {
  filterAggregateParams,
  getTableSortOptions,
  renderEventIdAsLinkable,
  renderTraceAsLinkable,
  transformEventsResponseToTable,
} from './errorsAndTransactions';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count()'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count()'],
  conditions: '',
  orderby: '-count()',
};

export type SeriesWithOrdering = [order: number, series: Series];

// TODO: Commented out functions will be given implementations
// to be able to make events-stats requests
export const TransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: true,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  SearchBar: EventsSearchBar,
  // filterSeriesSortOptions,
  // filterYAxisAggregateParams,
  // filterYAxisOptions,
  getTableFieldOptions: getEventsTableFieldOptions,
  // getTimeseriesSortOptions,
  getTableSortOptions,
  getGroupByFieldOptions: getEventsTableFieldOptions,
  handleOrderByReset,
  supportedDisplayTypes: [DisplayType.TABLE],
  getTableRequest: (
    api: Client,
    _widget: Widget,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    _onDemandControlContext?: OnDemandControlContext,
    limit?: number,
    cursor?: string,
    referrer?: string,
    _mepSetting?: MEPState | null
  ) => {
    return getEventsRequest(
      api,
      query,
      organization,
      pageFilters,
      limit,
      cursor,
      referrer
    );
  },
  transformTable: transformEventsResponseToTable,
  filterAggregateParams,
};

function getEventsTableFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
) {
  const measurements = getMeasurements();

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
    fieldKeys: TRANSACTION_FIELDS,
  });
}

function getCustomEventsFieldRenderer(field: string, meta: MetaType) {
  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable;
  }

  return getFieldRenderer(field, meta, false);
}

function getEventsRequest(
  api: Client,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  limit?: number,
  cursor?: string,
  referrer?: string
) {
  const url = `/organizations/${organization.slug}/events/`;
  const eventView = eventViewFromWidget('', query, pageFilters);

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    dataset: DiscoverDatasets.METRICS_ENHANCED,
  };

  if (query.orderby) {
    params.sort = typeof query.orderby === 'string' ? [query.orderby] : query.orderby;
  }

  return doDiscoverQuery<EventsTableData>(
    api,
    url,
    {
      ...eventView.generateQueryStringObject(),
      ...params,
    },
    // Tries events request up to 3 times on rate limit
    {
      retry: {
        statusCodes: [429],
        tries: 3,
      },
    }
  );
}
