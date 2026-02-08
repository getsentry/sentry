import {PreprodSearchBar} from 'sentry/components/preprod/preprodSearchBar';
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
  DataUnit,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {SizeUnit} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  DatasetConfig,
  SearchBarData,
  SearchBarDataProviderProps,
  WidgetBuilderSearchBarProps,
} from 'sentry/views/dashboards/datasetConfig/base';
import {handleOrderByReset} from 'sentry/views/dashboards/datasetConfig/base';
import {getTimeseriesSortOptions} from 'sentry/views/dashboards/datasetConfig/errorsAndTransactions';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {
  isEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {
  useMobileAppSizeSeriesQuery,
  useMobileAppSizeTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useMobileAppSizeWidgetQuery';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {useTraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {HIDDEN_PREPROD_ATTRIBUTES} from 'sentry/views/explore/constants';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['max(install_size)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['max(install_size)'],
  conditions: 'build_configuration_name:* git_head_ref:*',
  orderby: '',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['max', 'install_size', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

const PREPROD_APP_SIZE_AGGREGATIONS: Record<string, Aggregation> = {
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
  [AggregationKey.MIN]: {
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
    aggregations: PREPROD_APP_SIZE_AGGREGATIONS,
  });

  // Only add numeric size fields for use in aggregate functions
  // String fields like app_id, app_name, build_version are only used
  // for filtering/grouping and will be available via the search bar
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

  // Only allow numeric fields for aggregation
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
  for (const tag of Object.values(tags)) {
    tagOptions[`${tag.kind}:${tag.name}`] = {
      label: tag.name,
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: tag.name, dataType: tag.kind === 'tag' ? 'string' : 'number'},
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

  return (
    <PreprodSearchBar
      initialQuery={widgetQuery.conditions}
      projects={projects}
      onSearch={onSearch}
      portalTarget={portalTarget}
      searchSource="dashboards"
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
    useTraceItemAttributes('string', HIDDEN_PREPROD_ATTRIBUTES);
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributes('number', HIDDEN_PREPROD_ATTRIBUTES);
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useTraceItemAttributes('boolean', HIDDEN_PREPROD_ATTRIBUTES);

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.PREPROD,
      numberAttributes,
      stringAttributes,
      booleanAttributes,
      numberSecondaryAliases,
      stringSecondaryAliases,
      booleanSecondaryAliases,
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

function buildSeriesResultMap<T extends AggregationOutputType | DataUnit>(
  data: EventsStats | MultiSeriesEventsStats,
  widgetQuery: WidgetQuery,
  value: T
): Record<string, T> {
  const result: Record<string, T> = {};

  for (const aggregate of widgetQuery.aggregates ?? []) {
    result[aggregate] = value;
  }

  if (isMultiSeriesEventsStats(data)) {
    for (const seriesName of Object.keys(data)) {
      result[seriesName] = value;
    }
  }

  return result;
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
  axisRange: 'dataMin',
  getTableFieldOptions: getPrimaryFieldOptions,
  filterYAxisAggregateParams: () => filterAggregateParams,
  filterYAxisOptions,
  getGroupByFieldOptions,
  getTimeseriesSortOptions: (organization, widgetQuery, tags) =>
    getTimeseriesSortOptions(organization, widgetQuery, tags, getPrimaryFieldOptions),
  useSeriesQuery: useMobileAppSizeSeriesQuery,
  useTableQuery: useMobileAppSizeTableQuery,
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
  getSeriesResultType: (data, widgetQuery) =>
    buildSeriesResultMap(data, widgetQuery, 'size'),
  getSeriesResultUnit: (data, widgetQuery) =>
    buildSeriesResultMap(data, widgetQuery, SizeUnit.BYTE),
  filterAggregateParams,
  handleOrderByReset,
};
