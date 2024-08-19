import trimStart from 'lodash/trimStart';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {
  isEquation,
  isEquationAlias,
  SPAN_OP_BREAKDOWN_FIELDS,
  TRANSACTION_FIELDS,
} from 'sentry/utils/discover/fields';
import type {
  DiscoverQueryExtras,
  DiscoverQueryRequestParams,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets, TOP_N} from 'sentry/utils/discover/types';
import {getMeasurements} from 'sentry/utils/measurements/measurements';
import {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  type OnDemandControlContext,
  shouldUseOnDemandMetrics,
} from 'sentry/utils/performance/contexts/onDemandControl';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import type {Widget, WidgetQuery} from '../types';
import {DisplayType} from '../types';
import {eventViewFromWidget, getNumEquations, getWidgetInterval} from '../utils';
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
  SearchBar: props => (
    <EventsSearchBar savedSearchType={SavedSearchType.TRANSACTION} {...props} />
  ),
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

  const widgetQuery = widget.queries[queryIndex];
  const {displayType, limit} = widget;
  const {environments, projects} = pageFilters;
  const {start, end, period: statsPeriod} = pageFilters.datetime;
  const interval = getWidgetInterval(
    displayType,
    {start, end, period: statsPeriod},
    '1m'
  );

  let requestData;
  if (displayType === DisplayType.TOP_N) {
    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates[widgetQuery.aggregates.length - 1],
      includePrevious: false,
      referrer,
      partial: true,
      field: [...widgetQuery.columns, ...widgetQuery.aggregates],
      includeAllArgs: true,
      topEvents: TOP_N,
      dataset: isMEPEnabled
        ? DiscoverDatasets.METRICS_ENHANCED
        : DiscoverDatasets.TRANSACTIONS,
    };
    if (widgetQuery.orderby) {
      requestData.orderby = widgetQuery.orderby;
    }
  } else {
    requestData = {
      organization,
      interval,
      start,
      end,
      project: projects,
      environment: environments,
      period: statsPeriod,
      query: widgetQuery.conditions,
      yAxis: widgetQuery.aggregates,
      orderby: widgetQuery.orderby,
      includePrevious: false,
      referrer,
      partial: true,
      includeAllArgs: true,
      dataset: isMEPEnabled
        ? DiscoverDatasets.METRICS_ENHANCED
        : DiscoverDatasets.TRANSACTIONS,
    };
    if (widgetQuery.columns?.length !== 0) {
      requestData.topEvents = limit ?? TOP_N;
      requestData.field = [...widgetQuery.columns, ...widgetQuery.aggregates];

      // Compare field and orderby as aliases to ensure requestData has
      // the orderby selected
      // If the orderby is an equation alias, do not inject it
      const orderby = trimStart(widgetQuery.orderby, '-');
      if (
        widgetQuery.orderby &&
        !isEquationAlias(orderby) &&
        !requestData.field.includes(orderby)
      ) {
        requestData.field.push(orderby);
      }

      // The "Other" series is only included when there is one
      // y-axis and one widgetQuery
      requestData.excludeOther =
        widgetQuery.aggregates.length !== 1 || widget.queries.length !== 1;

      if (isEquation(trimStart(widgetQuery.orderby, '-'))) {
        const nextEquationIndex = getNumEquations(widgetQuery.aggregates);
        const isDescending = widgetQuery.orderby.startsWith('-');
        const prefix = isDescending ? '-' : '';

        // Construct the alias form of the equation and inject it into the request
        requestData.orderby = `${prefix}equation[${nextEquationIndex}]`;
        requestData.field = [
          ...widgetQuery.columns,
          ...widgetQuery.aggregates,
          trimStart(widgetQuery.orderby, '-'),
        ];
      }
    }
  }

  if (shouldUseOnDemandMetrics(organization, widget, onDemandControlContext)) {
    requestData.queryExtras = {
      ...requestData.queryExtras,
      ...{dataset: DiscoverDatasets.METRICS_ENHANCED},
    };
    return doOnDemandMetricsRequest(api, requestData, widget.widgetType);
  }

  return doEventsRequest<true>(api, requestData);
}
