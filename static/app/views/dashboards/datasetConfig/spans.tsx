import pickBy from 'lodash/pickBy';

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
import toArray from 'sentry/utils/array/toArray';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Aggregation, QueryFieldValue} from 'sentry/utils/discover/fields';
import {
  type DiscoverQueryExtras,
  type DiscoverQueryRequestParams,
  doDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  NO_ARGUMENT_SPAN_AGGREGATES,
} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {
  type DatasetConfig,
  handleOrderByReset,
} from 'sentry/views/dashboards/datasetConfig/base';
import {
  getTableSortOptions,
  getTimeseriesSortOptions,
  renderTraceAsLinkable,
  transformEventsResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import SpansSearchBar from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/spansSearchBar';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count(span.duration)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count(span.duration)'],
  conditions: '',
  orderby: '-count(span.duration)',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['count', 'span.duration', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

const EAP_AGGREGATIONS = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.reduce(
  (acc, aggregate) => {
    if (aggregate === AggregationKey.COUNT) {
      acc[AggregationKey.COUNT] = {
        isSortable: true,
        outputType: null,
        parameters: [
          {
            kind: 'column',
            columnTypes: ['number'],
            defaultValue: 'span.duration',
            required: true,
          },
        ],
      };
    } else if (aggregate === AggregationKey.COUNT_UNIQUE) {
      acc[AggregationKey.COUNT_UNIQUE] = {
        isSortable: true,
        outputType: null,
        parameters: [
          {
            kind: 'column',
            columnTypes: ['string'],
            defaultValue: 'span.op',
            required: true,
          },
        ],
      };
    } else if (NO_ARGUMENT_SPAN_AGGREGATES.includes(aggregate as AggregationKey)) {
      acc[aggregate] = {
        isSortable: true,
        outputType: null,
        parameters: [],
      };
    } else {
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
    }
    return acc;
  },
  {} as Record<AggregationKey, Aggregation>
);

export const SpansConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: SpansSearchBar,
  filterYAxisAggregateParams: () => filterAggregateParams,
  filterYAxisOptions,
  filterSeriesSortOptions,
  getTableFieldOptions: getPrimaryFieldOptions,
  getTableSortOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getPrimaryFieldOptions),
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
    _mepSetting?: MEPState | null,
    samplingMode?: SamplingMode
  ) => {
    return getEventsRequest(
      api,
      query,
      organization,
      pageFilters,
      limit,
      cursor,
      referrer,
      undefined,
      undefined,
      samplingMode
    );
  },
  getSeriesRequest,
  transformTable: transformEventsResponseToTable,
  transformSeries: transformEventsResponseToSeries,
  filterAggregateParams,
  getCustomFieldRenderer: (field, meta, widget, _organization) => {
    if (field === 'trace') {
      return renderTraceAsLinkable(widget);
    }
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

function _isNotNumericTag(option: FieldValueOption) {
  // Filter out numeric tags from primary options, they only show up in
  // the parameter fields for aggregate functions
  if ('dataType' in option.value.meta) {
    return option.value.meta.dataType !== 'number';
  }
  return true;
}

function filterAggregateParams(option: FieldValueOption, fieldValue?: QueryFieldValue) {
  // Allow for unknown values to be used for aggregate functions
  // This supports showing the tag value even if it's not in the current
  // set of tags.
  if ('unknown' in option.value.meta && option.value.meta.unknown) {
    return true;
  }

  if (
    fieldValue?.kind === 'function' &&
    fieldValue?.function[0] === AggregationKey.COUNT
  ) {
    return option.value.meta.name === 'span.duration';
  }

  const expectedDataType =
    fieldValue?.kind === 'function' &&
    fieldValue?.function[0] === AggregationKey.COUNT_UNIQUE
      ? 'string'
      : 'number';

  if ('dataType' in option.value.meta) {
    return option.value.meta.dataType === expectedDataType;
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
  queryExtras?: DiscoverQueryExtras,
  samplingMode?: SamplingMode
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
      ...(samplingMode ? {sampling: samplingMode} : {}),
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
    _isNotNumericTag(option) && !yAxisFilter(option);

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
  _mepSetting?: MEPState | null,
  samplingMode?: SamplingMode
) {
  const requestData = getSeriesRequestData(
    widget,
    queryIndex,
    organization,
    pageFilters,
    DiscoverDatasets.SPANS_EAP,
    referrer
  );

  if (samplingMode) {
    requestData.sampling = samplingMode;
  }

  return doEventsRequest<true>(api, requestData);
}

// Filters the primary options in the sort by selector
function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (option.value.kind === FieldValueKind.FUNCTION) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}
