import pickBy from 'lodash/pickBy';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {defined} from 'sentry/utils/defined';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  getEquationAliasIndex,
  isEquationAlias,
  stripEquationPrefix,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WIDGET_BUILDER_ATTRIBUTE_STALE_TIME} from 'sentry/views/dashboards/constants';
import {
  type DatasetConfig,
  type SearchBarData,
  type SearchBarDataProviderProps,
  type WidgetBuilderSearchBarProps,
} from 'sentry/views/dashboards/datasetConfig/base';
import {
  getTableSortOptions,
  getTimeseriesSortOptions,
} from 'sentry/views/dashboards/datasetConfig/events';
import {formatTraceMetricsFunction} from 'sentry/views/dashboards/datasetConfig/formatTraceMetricsFunction';
import {combineBaseFieldsWithTags} from 'sentry/views/dashboards/datasetConfig/utils/combineBaseFieldsWithEapTags';
import {traceMetricsResponseTransforms} from 'sentry/views/dashboards/datasetConfig/utils/traceMetricsResponseTransforms';
import {DisplayType, type WidgetQuery} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/useWidgetBuilderContext';
import {
  extractTraceMetricFromColumn,
  getTraceMetricDisplayFields,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {hasMultipleMetricsSelected} from 'sentry/views/dashboards/widgetBuilder/utils/hasMultipleMetricsSelected';
import {
  useTraceMetricsHeatmapQuery,
  useTraceMetricsSeriesQuery,
  useTraceMetricsTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useTraceMetricsWidgetQuery';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceMetricItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

// This is a placeholder that currently signals that no metric is selected
// When the metrics are loaded up, the first metric is selected and this will be filled out
const EMPTY_METRIC_SELECTION = 'sum(value)';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: [],
  columns: [],
  fieldAliases: [],
  aggregates: [EMPTY_METRIC_SELECTION],
  conditions: '',
  orderby: '',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['sum', 'value', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
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
  const organization = useOrganization();
  const supportsArrays = organization.features.includes('trace-item-array-query-support');
  const {
    selection: {projects},
  } = usePageFilters();
  const {attributeQuery, hasMultipleMetrics, traceMetrics} = useTraceMetricsSearchScope();

  // In the case of multiple metrics, wipe the query so it fetches all attributes
  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceMetricItemAttributes(
      {
        query: attributeQuery,
        enabled: defined(traceMetrics[0]), // Only enable if there is at least one metric
      },
      'string',
      HiddenTraceMetricSearchFields
    );
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceMetricItemAttributes(
      {
        query: attributeQuery,
        enabled: defined(traceMetrics[0]),
      },
      'number',
      HiddenTraceMetricSearchFields
    );
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useTraceMetricItemAttributes(
      {
        query: attributeQuery,
        enabled: defined(traceMetrics[0]),
      },
      'boolean',
      HiddenTraceMetricSearchFields
    );
  const {attributes: arrayAttributes, secondaryAliases: arraySecondaryAliases} =
    useTraceMetricItemAttributes(
      {
        query: attributeQuery,
        enabled: defined(traceMetrics[0]) && supportsArrays,
      },
      'array',
      HiddenTraceMetricSearchFields
    );

  return (
    <TraceItemSearchQueryBuilder
      initialQuery={widgetQuery.conditions}
      onSearch={onSearch}
      itemType={TraceItemDataset.TRACEMETRICS}
      arrayAttributes={supportsArrays ? arrayAttributes : {}}
      booleanAttributes={booleanAttributes}
      numberAttributes={numberAttributes}
      stringAttributes={stringAttributes}
      arraySecondaryAliases={supportsArrays ? arraySecondaryAliases : {}}
      booleanSecondaryAliases={booleanSecondaryAliases}
      numberSecondaryAliases={numberSecondaryAliases}
      stringSecondaryAliases={stringSecondaryAliases}
      searchSource="dashboards"
      projects={projects}
      portalTarget={portalTarget}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      namespace={hasMultipleMetrics ? undefined : traceMetrics?.[0]?.name}
      disableRecentSearches={hasMultipleMetrics}
      hiddenAttributeKeys={HiddenTraceMetricSearchFields}
      attributeQuery={attributeQuery}
    />
  );
}

function useTraceMetricsSearchBarDataProvider(
  props: SearchBarDataProviderProps
): SearchBarData {
  const {pageFilters, widgetQuery} = props;
  const organization = useOrganization();
  const supportsArrays = organization.features.includes('trace-item-array-query-support');
  const {attributeQuery, traceMetrics} = useTraceMetricsSearchScope();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceMetricItemAttributes(
      {query: attributeQuery, enabled: defined(traceMetrics[0])},
      'string',
      HiddenTraceMetricSearchFields
    );
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceMetricItemAttributes(
      {query: attributeQuery, enabled: defined(traceMetrics[0])},
      'number',
      HiddenTraceMetricSearchFields
    );
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useTraceMetricItemAttributes(
      {query: attributeQuery, enabled: defined(traceMetrics[0])},
      'boolean',
      HiddenTraceMetricSearchFields
    );
  const {attributes: arrayAttributes, secondaryAliases: arraySecondaryAliases} =
    useTraceMetricItemAttributes(
      {query: attributeQuery, enabled: defined(traceMetrics[0]) && supportsArrays},
      'array',
      HiddenTraceMetricSearchFields
    );

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.TRACEMETRICS,
      arrayAttributes: supportsArrays ? arrayAttributes : {},
      booleanAttributes,
      numberAttributes,
      stringAttributes,
      arraySecondaryAliases: supportsArrays ? arraySecondaryAliases : {},
      booleanSecondaryAliases,
      numberSecondaryAliases,
      stringSecondaryAliases,
      searchSource: 'dashboards',
      initialQuery: widgetQuery?.conditions ?? '',
      projects: pageFilters.projects,
      hiddenAttributeKeys: HiddenTraceMetricSearchFields,
      attributeQuery,
    });

  return {
    getFilterKeySections: () => filterKeySections,
    getFilterKeys: () => filterKeys,
    getTagValues,
  };
}

function useTraceMetricsSearchScope() {
  const {state: widgetBuilderState} = useWidgetBuilderContext();

  const displayFields = getTraceMetricDisplayFields(
    widgetBuilderState.displayType,
    widgetBuilderState.yAxis,
    widgetBuilderState.fields
  );
  const traceMetrics =
    displayFields?.map(extractTraceMetricFromColumn).filter(defined) ?? [];
  const hasMultipleMetrics = hasMultipleMetricsSelected(traceMetrics);
  const attributeQuery =
    !hasMultipleMetrics && traceMetrics[0]
      ? createTraceMetricFilter(traceMetrics[0])
      : undefined;

  return {attributeQuery, hasMultipleMetrics, traceMetrics};
}

export {formatTraceMetricsFunction};

export function useGlobalFilterTraceMetricsSearchBarDataProvider(
  props: Pick<SearchBarDataProviderProps, 'filterKeySearch' | 'pageFilters'>
): SearchBarData {
  const {filterKeySearch, pageFilters} = props;
  const attributeOptions = {
    search: filterKeySearch,
    staleTime: WIDGET_BUILDER_ATTRIBUTE_STALE_TIME,
  };

  const {
    attributes: stringAttributes,
    isLoading: stringAttributesLoading,
    secondaryAliases: stringSecondaryAliases,
  } = useTraceMetricItemAttributes(
    attributeOptions,
    'string',
    HiddenTraceMetricSearchFields
  );
  const {
    attributes: numberAttributes,
    isLoading: numberAttributesLoading,
    secondaryAliases: numberSecondaryAliases,
  } = useTraceMetricItemAttributes(
    attributeOptions,
    'number',
    HiddenTraceMetricSearchFields
  );
  const {
    attributes: booleanAttributes,
    isLoading: booleanAttributesLoading,
    secondaryAliases: booleanSecondaryAliases,
  } = useTraceMetricItemAttributes(
    attributeOptions,
    'boolean',
    HiddenTraceMetricSearchFields
  );
  const isFetchingFilterKeys =
    stringAttributesLoading || numberAttributesLoading || booleanAttributesLoading;

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.TRACEMETRICS,
      booleanAttributes,
      numberAttributes,
      stringAttributes,
      booleanSecondaryAliases,
      numberSecondaryAliases,
      stringSecondaryAliases,
      searchSource: 'dashboards',
      initialQuery: '',
      projects: pageFilters.projects,
      hiddenAttributeKeys: HiddenTraceMetricSearchFields,
    });

  return {
    getFilterKeySections: () => filterKeySections,
    getFilterKeys: () => filterKeys,
    getTagValues,
    isFetchingFilterKeys,
  };
}

export const TraceMetricsConfig: DatasetConfig<
  EventsTimeSeriesResponse,
  EventsTableData
> = {
  defaultCategoryField: 'project',
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false, // TODO: Enable this when equations in dashboards is GA'd
  SearchBar: TraceMetricsSearchBar,
  useSearchBarDataProvider: useTraceMetricsSearchBarDataProvider,
  filterSeriesSortOptions,
  getTableFieldOptions: getPrimaryFieldOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getPrimaryFieldOptions),
  // We've forced the sort options to use the table sort options UI because
  // we only want to allow sorting by selected aggregates.
  getTableSortOptions: (organization, widgetQuery) =>
    getTableSortOptions(organization, widgetQuery).map(({value, label}) => {
      if (isEquationAlias(value)) {
        return {
          label: `ƒ${getEquationAliasIndex(value) + 1}`,
          value,
        };
      }

      return {
        label,
        value,
      };
    }),
  getGroupByFieldOptions,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.BIG_NUMBER,
    DisplayType.CATEGORICAL_BAR,
    DisplayType.HEATMAP,
    DisplayType.LINE,
    DisplayType.TABLE,
  ],
  useSeriesQuery: useTraceMetricsSeriesQuery,
  useTableQuery: useTraceMetricsTableQuery,
  useHeatmapQuery: useTraceMetricsHeatmapQuery,
  ...traceMetricsResponseTransforms,
  getCustomFieldRenderer: (field, meta, widget, _organization, dashboardFilters) => {
    return getFieldRenderer(field, meta, false, widget, dashboardFilters);
  },
  getFieldHeaderMap: widgetQuery => {
    return (
      widgetQuery?.aggregates.reduce<Record<string, string>>((acc, aggregate) => {
        acc[aggregate] = stripEquationPrefix(formatTraceMetricsFunction(aggregate));
        return acc;
      }, {}) ?? {}
    );
  },
};

function getPrimaryFieldOptions(
  organization: Organization,
  tags?: TagCollection,
  _customMeasurements?: CustomMeasurementCollection
): Record<string, FieldValueOption> {
  return combineBaseFieldsWithTags(organization, tags, {});
}

function filterYAxisOptions() {
  return function (option: FieldValueOption) {
    return option.value.kind === FieldValueKind.FUNCTION;
  };
}

function getGroupByFieldOptions(organization: Organization, tags?: TagCollection) {
  const primaryFieldOptions = getPrimaryFieldOptions(organization, tags);
  const yAxisFilter = filterYAxisOptions();
  const filterGroupByOptions = (option: FieldValueOption) => !yAxisFilter(option);

  return pickBy(primaryFieldOptions, filterGroupByOptions);
}

function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (option.value.kind === FieldValueKind.FUNCTION) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}
