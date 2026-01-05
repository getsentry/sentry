import type {ReactNode} from 'react';
import pickBy from 'lodash/pickBy';

import {doEventsRequest} from 'sentry/actionCreators/events';
import type {ApiResult, Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import toArray from 'sentry/utils/array/toArray';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {parseFunction, type QueryFieldValue} from 'sentry/utils/discover/fields';
import type {DiscoverQueryRequestParams} from 'sentry/utils/discover/genericDiscoverQuery';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
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
import {combineBaseFieldsWithTags} from 'sentry/views/dashboards/datasetConfig/utils/combineBaseFieldsWithEapTags';
import {getSeriesRequestData} from 'sentry/views/dashboards/datasetConfig/utils/getSeriesRequestData';
import {useHasTraceMetricsDashboards} from 'sentry/views/dashboards/hooks/useHasTraceMetricsDashboards';
import {DisplayType, type Widget, type WidgetQuery} from 'sentry/views/dashboards/types';
import {eventViewFromWidget} from 'sentry/views/dashboards/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
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

  const traceMetric = widgetBuilderState.traceMetric ?? {name: '', type: ''};

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.TRACEMETRICS,
    enabled: hasTraceMetricsDashboards,
    query: createTraceMetricFilter(traceMetric),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(
      traceItemAttributeConfig,
      'string',
      HiddenTraceMetricSearchFields
    );
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(
      traceItemAttributeConfig,
      'number',
      HiddenTraceMetricSearchFields
    );

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
  const {state: widgetBuilderState} = useWidgetBuilderContext();

  const traceMetric = widgetBuilderState.traceMetric ?? {name: '', type: ''};

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.TRACEMETRICS,
    enabled: hasTraceMetricsDashboards,
    query: createTraceMetricFilter(traceMetric),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
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

export function formatTraceMetricsFunction(
  valueToParse: string,
  defaultValue: string | ReactNode = ''
) {
  const parsedFunction = parseFunction(valueToParse);
  if (parsedFunction) {
    return `${parsedFunction.name}(${parsedFunction.arguments[1] ?? '…'})`;
  }
  return defaultValue;
}

export const TraceMetricsConfig: DatasetConfig<
  EventsTimeSeriesResponse,
  EventsTableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: TraceMetricsSearchBar,
  useSearchBarDataProvider: useTraceMetricsSearchBarDataProvider,
  filterSeriesSortOptions,
  getTableFieldOptions: getPrimaryFieldOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getPrimaryFieldOptions),
  // We've forced the sort options to use the table sort options UI because
  // we only want to allow sorting by selected aggregates.
  getTableSortOptions: (organization, widgetQuery) =>
    getTableSortOptions(organization, widgetQuery).map(option => ({
      label: formatTraceMetricsFunction(option.value, option.label),
      value: option.value,
    })),
  getGroupByFieldOptions,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.LINE,
    DisplayType.BIG_NUMBER,
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
  transformSeries: (data, widgetQuery) => {
    const multiYAxis = new Set(widgetQuery.aggregates ?? []).size > 1;
    const hasGroupings = new Set(widgetQuery.columns).size > 0;

    return data.timeSeries.map(timeSeries => {
      // The function should always be defined when dealing with a successful
      // time series response
      const func = parseFunction(timeSeries.yAxis);
      if (func) {
        timeSeries.yAxis = `${func.name}(${func.arguments[1] ?? '…'})`;
      }
      return {
        data: timeSeries.values.map(value => ({
          name: value.timestamp,
          value: value.value ?? 0,
        })),

        // The series name needs to distinctively refer to the yAxis it belongs to
        // when multiple yAxes and groupings are present, otherwise the response
        // returns each series with its grouping but they overlap each other in the
        // legend
        seriesName:
          multiYAxis && hasGroupings && func
            ? `${formatTimeSeriesLabel(timeSeries)} : ${func.name}(…)`
            : formatTimeSeriesLabel(timeSeries),
      };
    });
  },
  getCustomFieldRenderer: (field, meta, _organization) => {
    return getFieldRenderer(field, meta, false);
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

  // The events-timeseries response errors on duplicate yAxis values, so we need to remove them
  requestData.yAxis = [...new Set(requestData.yAxis)];

  if (samplingMode) {
    requestData.sampling = samplingMode;
  }

  return doEventsRequest<true>(api, requestData) as unknown as Promise<
    ApiResult<EventsTimeSeriesResponse>
  >;
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
  _queryExtras?: any,
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
    dataset: DiscoverDatasets.TRACEMETRICS,
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

function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (option.value.kind === FieldValueKind.FUNCTION) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}
