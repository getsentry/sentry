import pickBy from 'lodash/pickBy';
import trimStart from 'lodash/trimStart';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import {Link} from 'sentry/components/core/link';
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
import type {EventData} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {emptyStringValue, getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  getEquationAliasIndex,
  isEquation,
  isEquationAlias,
  type Aggregation,
  type AggregationOutputType,
  type DataUnit,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {
  doDiscoverQuery,
  type DiscoverQueryExtras,
  type DiscoverQueryRequestParams,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {Container} from 'sentry/utils/discover/styles';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  NO_ARGUMENT_SPAN_AGGREGATES,
} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  handleOrderByReset,
  type DatasetConfig,
  type SearchBarData,
  type SearchBarDataProviderProps,
} from 'sentry/views/dashboards/datasetConfig/base';
import {
  getTableSortOptions,
  getTimeseriesSortOptions,
  renderTraceAsLinkable,
  transformEventsResponseToTable,
} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {combineBaseFieldsWithTags} from 'sentry/views/dashboards/datasetConfig/utils/combineBaseFieldsWithEapTags';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {isMultiSeriesEventsStats} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import SpansSearchBar from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/spansSearchBar';
import {isPerformanceScoreBreakdownChart} from 'sentry/views/dashboards/widgetBuilder/utils/isPerformanceScoreBreakdownChart';
import {transformPerformanceScoreBreakdownSeries} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useTraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

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
            columnTypes: ['number', 'string'],
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

function useSpansSearchBarDataProvider(props: SearchBarDataProviderProps): SearchBarData {
  const {pageFilters, widgetQuery} = props;
  const organization = useOrganization();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.SPANS,
    enabled: organization.features.includes('visibility-explore-view'),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.SPANS,
      numberAttributes,
      stringAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
      searchSource: 'dashboards',
      initialQuery: widgetQuery?.conditions ?? '',
      projects: pageFilters.projects,
      supportedAggregates: ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
    });
  return {
    getFilterKeys: () => filterKeys,
    getFilterKeySections: () => filterKeySections,
    getTagValues,
  };
}

export const SpansConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: true,
  SearchBar: SpansSearchBar,
  useSearchBarDataProvider: useSpansSearchBarDataProvider,
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
    DisplayType.DETAILS,
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
  transformSeries,
  filterAggregateParams,
  getCustomFieldRenderer: (field, meta, widget, _organization, dashboardFilters) => {
    if (field === 'id') {
      return renderEventInTraceView;
    }
    if (field === 'trace') {
      return renderTraceAsLinkable(widget);
    }
    return getFieldRenderer(field, meta, false, widget, dashboardFilters);
  },
  getSeriesResultUnit: (data, widgetQuery) => {
    const resultUnits: Record<string, DataUnit> = {};
    widgetQuery.fieldMeta?.forEach((meta, index) => {
      if (meta && widgetQuery.fields) {
        resultUnits[widgetQuery.fields[index]!] = meta.valueUnit;
      }
    });
    const isMultiSeriesStats = isMultiSeriesEventsStats(data);

    // if there's only one aggregate and more then one group by the series names are the name of the group, not the aggregate name
    // But we can just assume the units is for all the series
    // TODO: This doesn't work with multiple aggregates
    const firstMeta = widgetQuery.fieldMeta?.find(meta => meta !== null);
    if (
      isMultiSeriesStats &&
      firstMeta &&
      widgetQuery.aggregates?.length === 1 &&
      widgetQuery.columns?.length > 0
    ) {
      Object.keys(data).forEach(seriesName => {
        resultUnits[seriesName] = firstMeta.valueUnit;
      });
    }
    return resultUnits;
  },
  getSeriesResultType: (data, widgetQuery) => {
    const resultTypes: Record<string, AggregationOutputType> = {};
    widgetQuery.fieldMeta?.forEach((meta, index) => {
      if (meta && widgetQuery.fields) {
        resultTypes[widgetQuery.fields[index]!] = meta.valueType as AggregationOutputType;
      }
    });

    const isMultiSeriesStats = isMultiSeriesEventsStats(data);

    // if there's only one aggregate and more then one group by the series names are the name of the group, not the aggregate name
    // But we can just assume the units is for all the series
    // TODO: This doesn't work with multiple aggregates
    const firstMeta = widgetQuery.fieldMeta?.find(meta => meta !== null);
    if (
      isMultiSeriesStats &&
      firstMeta &&
      widgetQuery.aggregates?.length === 1 &&
      widgetQuery.columns?.length > 0
    ) {
      Object.keys(data).forEach(seriesName => {
        resultTypes[seriesName] = firstMeta.valueType;
      });
    }
    return resultTypes;
  },
};

function getPrimaryFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  _customMeasurements?: CustomMeasurementCollection
): Record<string, FieldValueOption> {
  return combineBaseFieldsWithTags(organization, tags, EAP_AGGREGATIONS);
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
  const hasQueueFeature = organization.features.includes(
    'visibility-dashboards-async-queue'
  );

  const params: DiscoverQueryRequestParams = {
    per_page: limit,
    cursor,
    referrer,
    dataset: DiscoverDatasets.SPANS,
    ...queryExtras,
  };

  let orderBy = query.orderby;

  if (orderBy) {
    if (isEquationAlias(trimStart(orderBy, '-'))) {
      const equations = query.fields?.filter(isEquation) ?? [];
      const equationIndex = getEquationAliasIndex(trimStart(orderBy, '-'));

      const orderby = equations[equationIndex];
      if (orderby) {
        orderBy = orderBy.startsWith('-') ? `-${orderby}` : orderby;
      }
    }
    params.sort = toArray(orderBy);
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
  const requestData = getSeriesRequestData(
    widget,
    queryIndex,
    organization,
    pageFilters,
    DiscoverDatasets.SPANS,
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
    if (
      option.value.kind === FieldValueKind.FUNCTION ||
      option.value.kind === FieldValueKind.EQUATION
    ) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}

function renderEventInTraceView(
  data: EventData,
  {location, organization}: RenderFunctionBaggage
) {
  const spanId = data.id;
  if (!spanId || typeof spanId !== 'string') {
    return <Container>{emptyStringValue}</Container>;
  }

  if (!data.trace) {
    return <Container>{getShortEventId(spanId)}</Container>;
  }

  const target = generateLinkToEventInTraceView({
    traceSlug: data.trace,
    timestamp: data.timestamp,
    targetId: data['transaction.span_id'],
    organization,
    location,
    spanId,
    source: TraceViewSources.DASHBOARDS,
  });

  return (
    <Link to={target}>
      <Container>{getShortEventId(spanId)}</Container>
    </Link>
  );
}

function transformSeries(
  data: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  widgetQuery: WidgetQuery
) {
  let eventsStats = data;
  // Kind of a hack, but performance score breakdown charts need a special transformation to display correctly.
  if (
    isMultiSeriesEventsStats(eventsStats) &&
    isPerformanceScoreBreakdownChart(widgetQuery)
  ) {
    eventsStats = transformPerformanceScoreBreakdownSeries(eventsStats);
  }
  return transformEventsResponseToSeries(eventsStats, widgetQuery);
}
