import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {
  type QueryFieldValue,
  SPAN_OP_BREAKDOWN_FIELDS,
  TRANSACTION_FIELDS,
} from 'sentry/utils/discover/fields';
import type {
  DiscoverQueryExtras,
  DiscoverQueryRequestParams,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  type OnDemandControlContext,
  shouldUseOnDemandMetrics,
} from 'sentry/utils/performance/contexts/onDemandControl';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import type {Widget, WidgetQuery} from '../types';
import {DisplayType} from '../types';
import {eventViewFromWidget} from '../utils';
import {EventsSearchBar} from '../widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';

import {type DatasetConfig, handleOrderByReset} from './base';
import {
  doOnDemandMetricsRequest,
  filterAggregateParams,
  filterSeriesSortOptions,
  filterYAxisAggregateParams,
  filterYAxisOptions,
  getCustomEventsFieldRenderer,
  getTableSortOptions,
  getTimeseriesSortOptions,
  transformEventsResponseToSeries,
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

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['count', '', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

export type SeriesWithOrdering = [order: number, series: Series];

export const TransactionsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
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
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
  ],
  getTableRequest: (
    api: Client,
    widget: Widget,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    onDemandControlContext?: OnDemandControlContext,
    limit?: number,
    cursor?: string,
    referrer?: string,
    mepSetting?: MEPState | null
  ) => {
    const useOnDemandMetrics = shouldUseOnDemandMetrics(
      organization,
      widget,
      onDemandControlContext
    );
    const queryExtras = {
      useOnDemandMetrics,
      onDemandType: 'dynamic_query',
    };
    return getEventsRequest(
      api,
      query,
      organization,
      pageFilters,
      limit,
      cursor,
      referrer,
      mepSetting,
      queryExtras
    );
  },
  getSeriesRequest: getEventsSeriesRequest,
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

function getEventsRequest(
  api: Client,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  limit?: number,
  cursor?: string,
  referrer?: string,
  mepSetting?: MEPState | null,
  queryExtras?: DiscoverQueryExtras
) {
  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;
  const url = `/organizations/${organization.slug}/events/`;
  const eventView = eventViewFromWidget('', query, pageFilters);

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    dataset: isMEPEnabled
      ? DiscoverDatasets.METRICS_ENHANCED
      : DiscoverDatasets.TRANSACTIONS,
    ...queryExtras,
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

function getEventsSeriesRequest(
  api: Client,
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters,
  onDemandControlContext?: OnDemandControlContext,
  referrer?: string,
  mepSetting?: MEPState | null
) {
  const isMEPEnabled = defined(mepSetting) && mepSetting !== MEPState.TRANSACTIONS_ONLY;

  const requestData = getSeriesRequestData(
    widget,
    queryIndex,
    organization,
    pageFilters,
    isMEPEnabled ? DiscoverDatasets.METRICS_ENHANCED : DiscoverDatasets.TRANSACTIONS,
    referrer
  );

  if (shouldUseOnDemandMetrics(organization, widget, onDemandControlContext)) {
    requestData.queryExtras = {
      ...requestData.queryExtras,
      ...{dataset: DiscoverDatasets.METRICS_ENHANCED},
    };
    return doOnDemandMetricsRequest(api, requestData, widget.widgetType);
  }

  return doEventsRequest<true>(api, requestData);
}
