import pickBy from 'lodash/pickBy';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {ApiResult, Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {parseFunction, type QueryFieldValue} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  handleOrderByReset,
  type DatasetConfig,
  type SearchBarData,
  type SearchBarDataProviderProps,
  type WidgetBuilderSearchBarProps,
} from 'sentry/views/dashboards/datasetConfig/base';
import {getTimeseriesSortOptions} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {useHasTraceMetricsDashboards} from 'sentry/views/dashboards/hooks/useHasTraceMetricsDashboards';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
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

// This is a placeholder that currently signals that no metric is selected
// When the metrics are loaded up, the first metric is selected and this will be filled out
export const EMPTY_METRIC_SELECTION = 'avg(value,,,-)';

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
  function: ['avg', 'value', undefined, undefined],
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
  const {
    selection: {projects},
  } = usePageFilters();
  const hasTraceMetricsDashboards = useHasTraceMetricsDashboards();
  const {state: widgetBuilderState} = useWidgetBuilderContext();

  // TODO: Make decision on how filtering works with multiple trace metrics
  // We should probably limit it to only one metric for now because there's no way
  // to filter by multiple metrics at the same time, unless the filter _ONLY_ includes
  // tags for both metrics.
  const traceMetric = widgetBuilderState.traceMetrics?.[0];

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
      namespace={traceMetric?.name}
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

export const TraceMetricsConfig: DatasetConfig<EventsTimeSeriesResponse, never> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: TraceMetricsSearchBar,
  useSearchBarDataProvider: useTraceMetricsSearchBarDataProvider,
  filterSeriesSortOptions,
  getTableFieldOptions: getPrimaryFieldOptions,
  // TODO: For some reason the aggregate isn't included in the sort options, add it.
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getPrimaryFieldOptions),
  getGroupByFieldOptions,
  handleOrderByReset,
  supportedDisplayTypes: [DisplayType.AREA, DisplayType.BAR, DisplayType.LINE],
  getSeriesRequest,
  transformTable: () => ({data: []}),
  transformSeries: (data, _widgetQuery) =>
    data.timeSeries.map(timeSeries => {
      const func = parseFunction(timeSeries.yAxis);
      if (func) {
        timeSeries.yAxis = `${func.name}(${func.arguments[1] ?? '…'})`;
      }
      return {
        data: timeSeries.values.map(value => ({
          name: value.timestamp / 1000, // Account for microseconds to milliseconds precision
          value: value.value ?? 0,
        })),
        seriesName: formatTimeSeriesLabel(timeSeries),
      };
    }),
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
    aggregations: {},
  });

  const metricTags = Object.values(tags ?? {}).reduce(
    function combineTag(acc, tag) {
      acc[`${tag.kind}:${tag.key}`] = {
        label: tag.name,
        value: {
          kind: FieldValueKind.TAG,

          // We have numeric and string tags which have the same
          // display name, but one is used for aggregates and the other
          // is used for grouping.
          meta: {name: tag.key, dataType: tag.kind === 'tag' ? 'string' : 'number'},
        },
      };

      return acc;
    },
    {} as Record<string, FieldValueOption>
  );

  return {...baseFieldOptions, ...metricTags};
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
    DiscoverDatasets.TRACEMETRICS,
    referrer
  );

  requestData.generatePathname = () =>
    `/organizations/${organization.slug}/events-timeseries/`;

  if (
    [DisplayType.LINE, DisplayType.AREA, DisplayType.BAR].includes(widget.displayType) &&
    (widget.queries[0]?.columns?.length ?? 0) > 0
  ) {
    requestData.queryExtras = {
      ...requestData.queryExtras,
      groupBy: widget.queries[0]!.columns,
    };
  }

  if (samplingMode) {
    requestData.sampling = samplingMode;
  }

  return doEventsRequest<true>(api, requestData) as unknown as Promise<
    ApiResult<EventsTimeSeriesResponse>
  >;
}

function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (option.value.kind === FieldValueKind.FUNCTION) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}
