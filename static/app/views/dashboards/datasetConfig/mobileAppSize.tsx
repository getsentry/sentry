import {doEventsRequest} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {
  Aggregation,
  AggregationOutputType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {isEventsStats} from 'sentry/views/dashboards/utils/isEventsStats';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {getSeriesRequestData} from './utils/getSeriesRequestData';
import type {
  DatasetConfig,
  SearchBarData,
  SearchBarDataProviderProps,
  WidgetBuilderSearchBarProps,
} from './base';
import {handleOrderByReset} from './base';
import {getTimeseriesSortOptions} from './errorsAndTransactions';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['max(install_size)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['max(install_size)'],
  conditions: 'app_id:* git_head_ref:*',
  orderby: '',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['max', 'install_size', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

// TODO(telkins): Add MIN aggregation once backend support is added
const MOBILE_APP_SIZE_AGGREGATIONS: Record<string, Aggregation> = {
  [AggregationKey.MAX]: {
    isSortable: true,
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['number'],
        defaultValue: 'install_size',
        required: true,
      },
    ],
  },
};

function getPrimaryFieldOptions(
  organization: Organization,
  _tags?: TagCollection,
  _customMeasurements?: CustomMeasurementCollection
): Record<string, FieldValueOption> {
  const baseFieldOptions = generateFieldOptions({
    organization,
    tagKeys: [],
    fieldKeys: [],
    aggregations: MOBILE_APP_SIZE_AGGREGATIONS,
  });

  // Only add numeric size fields for use in aggregate functions
  // String fields like app_id, app_name, build_version are only used
  // for filtering and will be available via the search bar
  const mobileAppSizeFields: Record<string, FieldValueOption> = {
    'measurement:install_size': {
      label: 'install_size',
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: 'install_size', dataType: 'number'},
      },
    },
    'measurement:download_size': {
      label: 'download_size',
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: 'download_size', dataType: 'number'},
      },
    },
  };

  return {...baseFieldOptions, ...mobileAppSizeFields};
}

function filterAggregateParams(option: FieldValueOption, _fieldValue?: QueryFieldValue) {
  if ('unknown' in option.value.meta && option.value.meta.unknown) {
    return true;
  }

  // Only allow numeric fields for max aggregation
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

function getGroupByFieldOptions(
  _organization: Organization,
  tags?: TagCollection
): Record<string, FieldValueOption> {
  if (!tags) {
    return {};
  }

  const tagOptions: Record<string, FieldValueOption> = {};
  for (const [key, tag] of Object.entries(tags)) {
    // Skip numeric fields since they are for aggregation, not grouping
    if (tag.kind === 'measurement' || key.includes('size')) {
      continue;
    }
    tagOptions[`field:${key}`] = {
      label: tag.name,
      value: {
        kind: FieldValueKind.FIELD,
        meta: {name: key, dataType: 'string'},
      },
    };
  }

  return tagOptions;
}

function MobileAppSizeSearchBar({
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

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributes('number');

  return (
    <TraceItemSearchQueryBuilder
      initialQuery={widgetQuery.conditions}
      onSearch={onSearch}
      itemType={TraceItemDataset.PREPROD}
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

function useMobileAppSizeSearchBarDataProvider(
  props: SearchBarDataProviderProps
): SearchBarData {
  const {
    selection: {projects},
  } = usePageFilters();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributes('number');

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.PREPROD,
      numberAttributes,
      stringAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
      searchSource: 'dashboards',
      initialQuery: props.widgetQuery?.conditions ?? '',
      projects,
    });
  return {
    getFilterKeySections: () => filterKeySections,
    getFilterKeys: () => filterKeys,
    getTagValues,
  };
}

export const MobileAppSizeConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats,
  TableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: MobileAppSizeSearchBar,
  useSearchBarDataProvider: useMobileAppSizeSearchBarDataProvider,
  supportedDisplayTypes: [DisplayType.LINE],
  getTableFieldOptions: getPrimaryFieldOptions,
  filterYAxisAggregateParams: () => filterAggregateParams,
  filterYAxisOptions,
  getGroupByFieldOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getPrimaryFieldOptions),
  getSeriesRequest: (
    api: Client,
    widget: Widget,
    queryIndex: number,
    organization: Organization,
    pageFilters: PageFilters,
    _onDemandControlContext?: OnDemandControlContext,
    referrer?: string,
    _mepSetting?: MEPState | null,
    samplingMode?: SamplingMode
  ) => {
    const requestData = getSeriesRequestData(
      widget,
      queryIndex,
      organization,
      pageFilters,
      DiscoverDatasets.PREPROD_SIZE,
      referrer
    );

    if (samplingMode) {
      requestData.sampling = samplingMode;
    }

    return doEventsRequest<true>(api, requestData);
  },
  transformTable: (
    data: TableData,
    _widgetQuery: WidgetQuery,
    _organization: Organization,
    _pageFilters: PageFilters
  ): TableData => {
    return data;
  },
  transformSeries: (
    data: EventsStats | MultiSeriesEventsStats,
    widgetQuery: WidgetQuery,
    _organization: Organization
  ): Series[] => {
    if (!data) {
      return [];
    }

    const aggregate =
      widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'App Size';

    if (isEventsStats(data)) {
      const seriesData = data.data
        .filter(
          ([, values]) =>
            values[0]?.count !== null &&
            values[0]?.count !== undefined &&
            values[0]?.count !== 0
        )
        .map(([timestamp, values]) => ({
          name: timestamp * 1000,
          value: values[0]!.count,
        }));

      const seriesName = widgetQuery.name || aggregate;

      return [{seriesName, data: seriesData}];
    }

    const multiResponse = data;
    const seriesWithOrder: Array<{order: number; series: Series}> = [];

    for (const [groupName, groupData] of Object.entries(multiResponse)) {
      if (!groupData?.data || !Array.isArray(groupData.data)) {
        continue;
      }

      const seriesData = groupData.data
        .filter(
          ([, values]) =>
            values[0]?.count !== null &&
            values[0]?.count !== undefined &&
            values[0]?.count !== 0
        )
        .map(([timestamp, values]) => ({
          name: timestamp * 1000,
          value: values[0]!.count,
        }));

      const seriesName = widgetQuery.name
        ? `${widgetQuery.name} : ${groupName}`
        : groupName;

      seriesWithOrder.push({
        order: groupData.order ?? 0,
        series: {seriesName, data: seriesData},
      });
    }

    return seriesWithOrder.sort((a, b) => a.order - b.order).map(item => item.series);
  },
  getSeriesResultType: (
    _data: EventsStats | MultiSeriesEventsStats,
    _widgetQuery: WidgetQuery
  ): Record<string, AggregationOutputType> => {
    return {
      'max(install_size)': 'size',
      'max(download_size)': 'size',
    };
  },
  filterAggregateParams,
  handleOrderByReset,
};
