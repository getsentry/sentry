import pickBy from 'lodash/pickBy';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import toArray from 'sentry/utils/array/toArray';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  type DiscoverQueryExtras,
  type DiscoverQueryRequestParams,
  doDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {
  type DatasetConfig,
  handleOrderByReset,
} from 'sentry/views/dashboards/datasetConfig/base';
import {
  getTableSortOptions,
  transformEventsResponseToSeries,
  transformEventsResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import SpansSearchBar from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/spansSearchBar';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count(span.duration)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count(span.duration)'],
  conditions: '',
  orderby: '',
};

const EAP_AGGREGATIONS = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.reduce((acc, aggregate) => {
  acc[aggregate] = {
    isSortable: true,
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['number', 'string'], // Need to keep the string type for unknown values before tags are resolved
        defaultValue: 'span.duration',
        required: true,
      },
    ],
  };
  return acc;
}, {});

// getTimeseriesSortOptions is undefined because we want to restrict the
// sort options to the same behaviour as tables. i.e. we are only able
// to sort by fields that have already been selected
export const SpansConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: SpansSearchBar,
  filterYAxisAggregateParams: () => filterAggregateParams,
  filterYAxisOptions,
  getTableFieldOptions: getPrimaryFieldOptions,
  getTableSortOptions,
  getGroupByFieldOptions,
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
  getSeriesRequest,
  transformTable: transformEventsResponseToTable,
  transformSeries: transformEventsResponseToSeries,
  filterTableOptions,
  filterAggregateParams,
  getCustomFieldRenderer: (field, meta, _organization) => {
    return getFieldRenderer(field, meta, false);
  },
};

function getPrimaryFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  _customMeasurements?: CustomMeasurementCollection
): Record<string, FieldValueOption> {
  const baseFieldOptions = generateFieldOptions({
    organization,
    tagKeys: [],
    fieldKeys: [],
    aggregations: EAP_AGGREGATIONS,
  });

  const spanTags = Object.values(tags ?? {}).reduce(
    (acc, tag) => ({
      ...acc,
      [`${tag.kind}:${tag.key}`]: {
        label: tag.name,
        value: {
          kind: FieldValueKind.TAG,

          // We have numeric and string tags which have the same
          // display name, but one is used for aggregates and the other
          // is used for grouping.
          meta: {name: tag.key, dataType: tag.kind === 'tag' ? 'string' : 'number'},
        },
      },
    }),
    {}
  );

  return {...baseFieldOptions, ...spanTags};
}

function filterTableOptions(option: FieldValueOption) {
  // Filter out numeric tags from primary options, they only show up in
  // the parameter fields for aggregate functions
  if ('dataType' in option.value.meta) {
    return option.value.meta.dataType !== 'number';
  }
  return true;
}

function filterAggregateParams(option: FieldValueOption) {
  // Allow for unknown values to be used for aggregate functions
  // This supports showing the tag value even if it's not in the current
  // set of tags.
  if ('unknown' in option.value.meta && option.value.meta.unknown) {
    return true;
  }
  if ('dataType' in option.value.meta) {
    return option.value.meta.dataType === 'number';
  }
  return true;
}

function filterYAxisOptions() {
  return function (option: FieldValueOption) {
    return option.value.kind === FieldValueKind.FUNCTION;
  };
}

function getEventsRequest(
  api: Client,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  limit?: number,
  cursor?: string,
  referrer?: string,
  _mepSetting?: MEPState | null,
  queryExtras?: DiscoverQueryExtras
) {
  const url = `/organizations/${organization.slug}/events/`;
  const eventView = eventViewFromWidget('', query, pageFilters);

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    dataset: DiscoverDatasets.SPANS_EAP,
    ...queryExtras,
  };

  if (query.orderby) {
    params.sort = toArray(query.orderby);
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

function getGroupByFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
) {
  const primaryFieldOptions = getPrimaryFieldOptions(
    organization,
    tags,
    customMeasurements
  );
  const yAxisFilter = filterYAxisOptions();

  // The only options that should be returned as valid group by options
  // are string tags
  const filterGroupByOptions = (option: FieldValueOption) =>
    filterTableOptions(option) && !yAxisFilter(option);

  return pickBy(primaryFieldOptions, filterGroupByOptions);
}

function getSeriesRequest(
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
    DiscoverDatasets.SPANS_EAP,
    referrer
  );
  return doEventsRequest<true>(api, requestData);
}
