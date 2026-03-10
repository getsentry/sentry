import pickBy from 'lodash/pickBy';

import {Link} from '@sentry/scraps/link';

import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventData} from 'sentry/utils/discover/eventView';
import type {RenderFunctionBaggage} from 'sentry/utils/discover/fieldRenderers';
import {emptyStringValue, getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  stripEquationPrefix,
  type Aggregation,
  type AggregationOutputType,
  type DataUnit,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {
  AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  NO_ARGUMENT_SPAN_AGGREGATES,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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
import {
  DisplayType,
  type DashboardFilters,
  type Widget,
  type WidgetQuery,
} from 'sentry/views/dashboards/types';
import {getWidgetTableRowExploreUrlFunction} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';
import {
  isEventsStats,
  isGroupedMultiSeriesEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import SpansSearchBar from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/spansSearchBar';
import {isPerformanceScoreBreakdownChart} from 'sentry/views/dashboards/widgetBuilder/utils/isPerformanceScoreBreakdownChart';
import {transformPerformanceScoreBreakdownSeries} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';
import {
  useSpansSeriesQuery,
  useSpansTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useSpansWidgetQuery';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {useTraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

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

const INTERNAL_ERROR_COUNT_FIELD = 'count_if(span.status,equals,internal_error)';

function useSpansSearchBarDataProvider(props: SearchBarDataProviderProps): SearchBarData {
  const {pageFilters, widgetQuery} = props;
  const organization = useOrganization();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useSpanItemAttributes(
      {enabled: organization.features.includes('visibility-explore-view')},
      'string'
    );
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useSpanItemAttributes(
      {enabled: organization.features.includes('visibility-explore-view')},
      'number'
    );
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useSpanItemAttributes(
      {enabled: organization.features.includes('visibility-explore-view')},
      'boolean'
    );

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.SPANS,
      booleanAttributes,
      numberAttributes,
      stringAttributes,
      booleanSecondaryAliases,
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

/**
 * Generic helper to extract metadata (units or types) from events-stats series data.
 * Handles both MultiSeriesEventsStats and GroupedMultiSeriesEventsStats responses.
 */
function extractSeriesMetadata<T>({
  data,
  getFieldMetaValue,
  getMetaField,
  widgetQuery,
}: {
  data: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
  getFieldMetaValue: (meta: NonNullable<WidgetQuery['fieldMeta']>[number] | null) => T;
  getMetaField: (seriesMeta: EventsStats['meta'], aggregate: string) => T;
  widgetQuery: WidgetQuery;
}): Record<string, T> {
  const result: Record<string, T> = {};

  // Initialize from fieldMeta if available
  widgetQuery.fieldMeta?.forEach((meta, index) => {
    if (meta && widgetQuery.fields?.[index]) {
      result[widgetQuery.fields[index]] = getFieldMetaValue(meta);
    }
  });

  if (isEventsStats(data)) {
    // Plain EventsStats: single aggregate, no grouping. Meta is at the top level.
    if (data.meta) {
      widgetQuery.aggregates?.forEach(aggregate => {
        if (aggregate && !(aggregate in result)) {
          result[aggregate] = getMetaField(data.meta, aggregate);
        }
      });
    }
  } else if (isMultiSeriesEventsStats(data)) {
    // If there's only one aggregate and multiple groupings, series names are group names
    // In this case, we can use the first meta value for all series
    const firstMeta = widgetQuery.fieldMeta?.find(meta => meta !== null);
    const isSingleAggregateMultiGroup =
      firstMeta &&
      widgetQuery.aggregates?.length === 1 &&
      widgetQuery.columns?.length > 0;

    if (isSingleAggregateMultiGroup) {
      // Use hardcoded config for all series
      Object.keys(data).forEach(seriesName => {
        // Don't overwrite fieldMeta values
        if (!(seriesName in result)) {
          result[seriesName] = getFieldMetaValue(firstMeta);
        }
      });
    } else {
      Object.keys(data).forEach(seriesName => {
        const seriesData = data[seriesName];
        if (!seriesData?.meta) {
          return;
        }
        widgetQuery.aggregates?.forEach(aggregate => {
          // Multi-series can be keyed by aggregate or series name depending on aggregate count
          const key = widgetQuery.aggregates?.length > 1 ? aggregate : seriesName;
          // Don't overwrite fieldMeta values
          if (seriesData.meta && !(key in result)) {
            result[key] = getMetaField(seriesData.meta, aggregate);
          }
        });
      });
    }
  } else if (isGroupedMultiSeriesEventsStats(data)) {
    Object.keys(data).forEach(groupName => {
      widgetQuery.aggregates?.forEach(aggregate => {
        const seriesData = data[groupName]?.[aggregate] as EventsStats;
        // Don't overwrite fieldMeta values
        if (seriesData?.meta && aggregate && !(aggregate in result)) {
          result[aggregate] = getMetaField(seriesData.meta, aggregate);
        }
      });
    });
  }

  return result;
}

export const SpansConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultCategoryField: 'transaction',
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
    DisplayType.CATEGORICAL_BAR,
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
    DisplayType.DETAILS,
    DisplayType.SERVER_TREE,
  ],
  useSeriesQuery: useSpansSeriesQuery,
  useTableQuery: useSpansTableQuery,
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
    if (
      field === SpanFields.TRANSACTION &&
      !widget?.queries?.[0]?.linkedDashboards?.some(
        linkedDashboard => linkedDashboard.field === SpanFields.TRANSACTION
      )
    ) {
      return renderTransactionAsLinkable;
    }
    const strippedField = stripEquationPrefix(field);
    if (
      field === INTERNAL_ERROR_COUNT_FIELD ||
      strippedField === INTERNAL_ERROR_COUNT_FIELD
    ) {
      return renderInternalErrorCount(widget, dashboardFilters);
    }
    return getFieldRenderer(field, meta, false, widget, dashboardFilters);
  },
  getSeriesResultUnit: (data, widgetQuery) => {
    return extractSeriesMetadata({
      data,
      widgetQuery,
      getFieldMetaValue: meta => meta?.valueUnit as DataUnit,
      getMetaField: (seriesMeta, aggregate) => seriesMeta?.units?.[aggregate] as DataUnit,
    });
  },
  getSeriesResultType: (data, widgetQuery) => {
    return extractSeriesMetadata({
      data,
      widgetQuery,
      getFieldMetaValue: meta => meta?.valueType as AggregationOutputType,
      getMetaField: (seriesMeta, aggregate) =>
        seriesMeta?.fields?.[aggregate] as AggregationOutputType,
    });
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

function renderTransactionAsLinkable(data: EventData, baggage: RenderFunctionBaggage) {
  const transaction = data.transaction;
  if (!transaction || typeof transaction !== 'string') {
    return <Container>{emptyStringValue}</Container>;
  }

  const {organization, location, projects} = baggage;

  let projectID: string | string[] | undefined;
  const filterProjects = location?.query.project;

  if (typeof filterProjects === 'string' && filterProjects !== '-1') {
    projectID = filterProjects;
  } else {
    const projectMatch = projects?.find(
      project =>
        project.slug && [data['project.name'], data.project].includes(project.slug)
    );
    projectID = projectMatch ? [projectMatch.id] : undefined;
  }

  const filters = new MutableSearch('');

  // Filters on the transaction summary page won't match the dashboard because transaction summary isn't on eap yet.
  if (data[SpanFields.SPAN_OP]) {
    filters.addFilterValue('transaction.op', data[SpanFields.SPAN_OP]);
  }
  if (data[SpanFields.REQUEST_METHOD]) {
    const isEap = organization.features.includes('performance-transaction-summary-eap');
    filters.addFilterValue(
      isEap ? 'request.method' : 'http.method',
      data[SpanFields.REQUEST_METHOD]
    );
  }

  const target = transactionSummaryRouteWithQuery({
    organization,
    transaction: String(transaction),
    projectID,
    query: location?.query,
    additionalQuery: {query: filters.formatString()},
  });

  return (
    <Link to={target}>
      <Container>{transaction}</Container>
    </Link>
  );
}

// Renders the count of internal errors for a given widget and dashboard filters.
// Displays 0 if a row receives null count.
// Returns a link to the explore page with the internal error filter applied.
function renderInternalErrorCount(widget?: Widget, dashboardFilters?: DashboardFilters) {
  return function (data: EventData, baggage: RenderFunctionBaggage) {
    const {organization, eventView} = baggage;
    const selection = eventView?.getPageFilters();
    const value =
      data[INTERNAL_ERROR_COUNT_FIELD] || data[`equation|${INTERNAL_ERROR_COUNT_FIELD}`];
    const count = typeof value === 'number' ? value : 0;

    if (count === 0) {
      return <NumberContainer>0</NumberContainer>;
    }

    if (!widget || !selection) {
      return <NumberContainer>{count}</NumberContainer>;
    }

    const baseConditions = widget.queries[0]?.conditions ?? '';
    const errorQuery = new MutableSearch(baseConditions);
    errorQuery.addStringFilter('span.status:internal_error');
    const widgetWithErrorFilter: Widget = {
      ...widget,
      queries: widget.queries.map(q => ({
        ...q,
        conditions: errorQuery.formatString(),
      })),
    };

    const getRowExploreUrl = getWidgetTableRowExploreUrlFunction(
      selection,
      widgetWithErrorFilter,
      organization,
      dashboardFilters
    );
    const target = getRowExploreUrl(data);

    return (
      <NumberContainer>
        <Link to={target}>{count}</Link>
      </NumberContainer>
    );
  };
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
