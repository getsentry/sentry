import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {useCustomMeasurementsConfig} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  ERROR_FIELDS,
  ERRORS_AGGREGATION_FUNCTIONS,
  generateAggregateFields,
  getAggregations,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {AggregationKey} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import useOrganization from 'sentry/utils/useOrganization';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {EventsSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';
import {useResultsSearchBarDataProvider} from 'sentry/views/discover/results/resultsSearchQueryBuilder';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

import {
  handleOrderByReset,
  type DatasetConfig,
  type SearchBarData,
  type SearchBarDataProviderProps,
} from './base';
import {
  filterAggregateParams,
  filterSeriesSortOptions,
  filterYAxisAggregateParams, // TODO: Does this need to be overridden?
  getTableSortOptions,
  getTimeseriesSortOptions,
  renderEventIdAsLinkable,
  renderTraceAsLinkable,
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

function useEventsSearchBarDataProvider(
  props: SearchBarDataProviderProps
): SearchBarData {
  const {pageFilters, widgetQuery} = props;
  const organization = useOrganization();
  const {customMeasurements} = useCustomMeasurementsConfig({
    organization,
    selection: pageFilters,
  });
  const eventView = eventViewFromWidget(
    '',
    widgetQuery ?? DEFAULT_WIDGET_QUERY,
    pageFilters
  );
  const fields = eventView.hasAggregateField()
    ? generateAggregateFields(organization, eventView.fields)
    : eventView.fields;

  return useResultsSearchBarDataProvider({
    projectIds: eventView.project,
    dataset: DiscoverDatasets.ERRORS,
    fields,
    customMeasurements,
  });
}

export const ErrorsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: true,
  getCustomFieldRenderer: getCustomEventsFieldRenderer,
  SearchBar: EventsSearchBar,
  useSearchBarDataProvider: useEventsSearchBarDataProvider,
  filterSeriesSortOptions,
  filterYAxisAggregateParams,
  filterYAxisOptions,
  getTableFieldOptions: getEventsTableFieldOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getEventsTableFieldOptions),
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
  getSeriesRequest: getErrorsSeriesRequest,
  transformTable: transformEventsResponseToTable,
  transformSeries: transformEventsResponseToSeries,
  filterAggregateParams,
};

function getEventsTableFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  _customMeasurements?: CustomMeasurementCollection
) {
  const aggregates = getAggregations(DiscoverDatasets.ERRORS);
  return generateFieldOptions({
    organization,
    tagKeys: Object.values(tags ?? {}).map(({key}) => key),
    aggregations: Object.keys(aggregates)
      .filter(key => ERRORS_AGGREGATION_FUNCTIONS.includes(key as AggregationKey))
      .reduce((obj, key) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        obj[key] = aggregates[key];
        return obj;
      }, {}),
    fieldKeys: ERROR_FIELDS,
  });
}

function getCustomEventsFieldRenderer(field: string, meta: MetaType, widget?: Widget) {
  if (field === 'id') {
    return renderEventIdAsLinkable;
  }

  if (field === 'trace') {
    return renderTraceAsLinkable(widget);
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
  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    dataset: DiscoverDatasets.ERRORS,
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
    // Tries events request up to 10 times on rate limit
    {
      retry: hasQueueFeature
        ? // The queue will handle retries, so we don't need to retry here
          undefined
        : {
            statusCodes: [429],
            tries: 10,
          },
    }
  );
}

// The y-axis options are a strict set of available aggregates
function filterYAxisOptions(_displayType: DisplayType) {
  return (option: FieldValueOption) => {
    return ERRORS_AGGREGATION_FUNCTIONS.includes(
      option.value.meta.name as AggregationKey
    );
  };
}

function getErrorsSeriesRequest(
  api: Client,
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters,
  _onDemandControlContext?: OnDemandControlContext,
  referrer?: string,
  _mepSetting?: MEPState | null
) {
  const requestData = getSeriesRequestData(
    widget,
    queryIndex,
    organization,
    pageFilters,
    DiscoverDatasets.ERRORS,
    referrer
  );
  return doEventsRequest<true>(api, requestData);
}
