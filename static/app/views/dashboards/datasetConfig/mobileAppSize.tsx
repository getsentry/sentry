import type {Client, ResponseMeta} from 'sentry/api';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {
  Aggregation,
  AggregationOutputType,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import {AggregationKey} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {getWidgetInterval} from 'sentry/views/dashboards/utils';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributesWithConfig} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

import type {
  DatasetConfig,
  SearchBarData,
  SearchBarDataProviderProps,
  WidgetBuilderSearchBarProps,
} from './base';
import {handleOrderByReset} from './base';
import {getTimeseriesSortOptions} from './errorsAndTransactions';

export interface AppSizeResponse {
  data: Array<[number, Array<{count: number | null}>]>;
  end: number;
  meta: {
    fields: Record<string, string>;
  };
  start: number;
  order?: number;
}

// Multi-series response when groupBy is used - keyed by group value (e.g., "ios", "android")
export type MultiAppSizeResponse = Record<string, AppSizeResponse>;

// Query building uses standard event-stats with dataset=preprodSize.
// This serves as the initial template for new widgets.
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
    'field:install_size': {
      label: 'Install Size',
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: 'install_size', dataType: 'number'},
      },
    },
    'field:download_size': {
      label: 'Download Size',
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: 'download_size', dataType: 'number'},
      },
    },
  };

  return {...baseFieldOptions, ...mobileAppSizeFields};
}

function filterAggregateParams(option: FieldValueOption, _fieldValue?: QueryFieldValue) {
  // Allow for unknown values
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

  // Convert tags to field options, filtering out numeric fields (those are for aggregation)
  const tagOptions: Record<string, FieldValueOption> = {};
  for (const [key, tag] of Object.entries(tags)) {
    // Skip numeric fields - those are for aggregation, not grouping
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
  const organization = useOrganization();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.PREPROD,
    enabled: organization.features.includes('preprod-frontend-routes'),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

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
  const {pageFilters, widgetQuery} = props;
  const organization = useOrganization();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.PREPROD,
    enabled: organization.features.includes('preprod-frontend-routes'),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.PREPROD,
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

export const MobileAppSizeConfig: DatasetConfig<AppSizeResponse[], TableData> = {
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
    _referrer?: string,
    _mepSetting?: MEPState | null,
    _samplingMode?: SamplingMode
  ): Promise<[AppSizeResponse[], string | undefined, ResponseMeta | undefined]> => {
    const widgetQuery = widget.queries[queryIndex];
    if (!widgetQuery) {
      return Promise.reject(new Error('No widget query found'));
    }

    const yAxis =
      widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'max(install_size)';

    const {start, end, period} = pageFilters.datetime;
    const interval = getWidgetInterval(widget, pageFilters.datetime, '1d');

    const baseParams: Record<string, any> = {
      dataset: 'preprodSize',
      project: pageFilters.projects,
      environment: pageFilters.environments,
      start: start ? new Date(start).toISOString() : undefined,
      end: end ? new Date(end).toISOString() : undefined,
      statsPeriod: period || (!start && !end ? '14d' : undefined),
      interval,
      yAxis,
      query: widgetQuery.conditions || '',
    };

    if (widgetQuery.columns && widgetQuery.columns.length > 0) {
      baseParams.topEvents = widget.limit ?? TOP_N;
      baseParams.field = [...widgetQuery.columns, yAxis];
    }

    return api
      .requestPromise(`/organizations/${organization.slug}/events-stats/`, {
        method: 'GET',
        query: baseParams,
      })
      .then(response => [[response], undefined, undefined]);
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
    data: AppSizeResponse[],
    widgetQuery: WidgetQuery,
    _organization: Organization
  ): Series[] => {
    const response = data[0];
    if (!response) {
      return [];
    }

    const aggregate =
      widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'App Size';

    // Check if this is a multi-series response (grouped by some field)
    // Multi-series responses don't have a 'data' array directly, they have group keys
    const isMultiSeries = !Array.isArray(response.data);

    if (isMultiSeries) {
      // Multi-series: response is keyed by group values (e.g., "ios", "android")
      const multiResponse = response as unknown as MultiAppSizeResponse;
      const seriesWithOrder: Array<{order: number; series: Series}> = [];

      for (const [groupName, groupData] of Object.entries(multiResponse)) {
        if (!groupData.data || !Array.isArray(groupData.data)) {
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
            value: values[0]!.count as number,
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
    }

    // Single series: original format
    const seriesData = response.data
      .filter(
        ([, values]) =>
          values[0]?.count !== null &&
          values[0]?.count !== undefined &&
          values[0]?.count !== 0
      )
      .map(([timestamp, values]) => ({
        name: timestamp * 1000,
        value: values[0]!.count as number,
      }));

    const seriesName = widgetQuery.name || aggregate;

    return [{seriesName, data: seriesData}];
  },
  getSeriesResultType: (
    _data: AppSizeResponse[],
    _widgetQuery: WidgetQuery
  ): Record<string, AggregationOutputType> => {
    return {
      'max(install_size)': 'size_base10',
      'max(download_size)': 'size_base10',
    };
  },
  filterAggregateParams,
  handleOrderByReset,
};
