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
  doDiscoverQuery,
  type DiscoverQueryExtras,
  type DiscoverQueryRequestParams,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  handleOrderByReset,
  type DatasetConfig,
  type SearchBarData,
  type SearchBarDataProviderProps,
  type WidgetBuilderSearchBarProps,
} from 'sentry/views/dashboards/datasetConfig/base';
import {
  getTableSortOptions,
  getTimeseriesSortOptions,
  transformEventsResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {useHasTraceMetricsDashboards} from 'sentry/views/dashboards/hooks/useHasTraceMetricsDashboards';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['avg(value)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['avg(value)'],
  conditions: '',
  orderby: '-avg(value)',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['avg', 'value', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

// Stub aggregations - to be implemented
const TRACE_METRICS_AGGREGATIONS: Record<AggregationKey, Aggregation> = {
  [AggregationKey.COUNT]: {
    isSortable: true,
    outputType: null,
    parameters: [],
  },
};

function TraceMetricsSearchBar({
  widgetQuery,
  onSearch,
  portalTarget,
  onClose,
}: Pick<
  WidgetBuilderSearchBarProps,
  'widgetQuery' | 'onSearch' | 'portalTarget' | 'onClose'
>) {
  const {
    selection: {projects},
  } = usePageFilters();
  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();

  // TODO: Implement proper trace metrics attributes
  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.TRACEMETRICS,
    enabled: hasTraceMetricsDashboards,
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  return (
    <TraceItemSearchQueryBuilder
      initialQuery={widgetQuery.conditions}
      onSearch={onSearch}
      itemType={TraceItemDataset.TRACEMETRICS}
      numberAttributes={numberAttributes}
      stringAttributes={stringAttributes}
      numberSecondaryAliases={numberSecondaryAliases}
      stringSecondaryAliases={stringSecondaryAliases}
      searchSource="dashboards"
      projects={projects}
      portalTarget={portalTarget}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
    />
  );
}

function useTraceMetricsSearchBarDataProvider(
  props: SearchBarDataProviderProps
): SearchBarData {
  const {pageFilters, widgetQuery} = props;
  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.TRACEMETRICS,
    enabled: hasTraceMetricsDashboards,
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  const {filterKeys, filterKeySections, getTagValues} = useSearchQueryBuilderProps({
    itemType: TraceItemDataset.TRACEMETRICS,
    numberAttributes,
    stringAttributes,
    numberSecondaryAliases,
    stringSecondaryAliases,
    searchSource: 'dashboards',
    initialQuery: widgetQuery?.conditions ?? '',
    projects: pageFilters.projects,
  });

  return {
    getFilterKeySections: () => filterKeySections,
    getFilterKeys: () => filterKeys,
    getTagValues,
  };
}

export const TraceMetricsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: TraceMetricsSearchBar,
  useSearchBarDataProvider: useTraceMetricsSearchBarDataProvider,
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
    // TODO: Implement actual trace metrics request logic
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
  getCustomFieldRenderer: (field, meta, _organization) => {
    return getFieldRenderer(field, meta, false);
  },
};

function getPrimaryFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  _customMeasurements?: CustomMeasurementCollection
): Record<string, FieldValueOption> {
  // TODO: Implement proper field options for trace metrics
  const baseFieldOptions = generateFieldOptions({
    organization,
    tagKeys: [],
    fieldKeys: [],
    aggregations: TRACE_METRICS_AGGREGATIONS,
  });

  const metricsTags = Object.values(tags ?? {}).reduce(
    (acc, tag) => ({
      ...acc,
      [`${tag.kind}:${tag.key}`]: {
        label: tag.name,
        value: {
          kind: FieldValueKind.TAG,
          meta: {name: tag.key, dataType: tag.kind === 'tag' ? 'string' : 'number'},
        },
      },
    }),
    {}
  );

  return {...baseFieldOptions, ...metricsTags};
}

function filterAggregateParams(option: FieldValueOption, fieldValue?: QueryFieldValue) {
  // TODO: Implement proper aggregate parameter filtering
  if ('unknown' in option.value.meta && option.value.meta.unknown) {
    return true;
  }

  if (
    fieldValue?.kind === 'function' &&
    fieldValue?.function[0] === AggregationKey.COUNT
  ) {
    return true;
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
  // TODO: Update to use appropriate dataset for trace metrics
  const url = `/organizations/${organization.slug}/events/`;
  const eventView = eventViewFromWidget('', query, pageFilters);

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    dataset: DiscoverDatasets.TRACEMETRICS,
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
    {
      retry: {
        statusCodes: [429],
        tries: 10,
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
  const filterGroupByOptions = (option: FieldValueOption) => !yAxisFilter(option);

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
  // TODO: Update to use appropriate dataset for trace metrics
  const requestData = getSeriesRequestData(
    widget,
    queryIndex,
    organization,
    pageFilters,
    DiscoverDatasets.TRACEMETRICS,
    referrer
  );

  if (samplingMode) {
    requestData.sampling = samplingMode;
  }

  return doEventsRequest<true>(api, requestData);
}

function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (option.value.kind === FieldValueKind.FUNCTION) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}
