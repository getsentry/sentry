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
import {AggregationKey} from 'sentry/utils/fields';
import type {MEPState} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
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

export interface AppSizeResponse {
  data: Array<[number, Array<{count: number | null}>]>;
  end: number;
  meta: {
    fields: Record<string, string>;
  };
  start: number;
}

// Query building uses standard event-stats with dataset=preprodSize.
// This serves as the initial template for new widgets.
const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['max(max_install_size)'],
  columns: [],
  fieldAliases: [],
  aggregates: ['max(max_install_size)'],
  conditions: 'app_id:* git_head_ref:*',
  orderby: '',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['max', 'max_install_size', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

// Define aggregates that work with mobile app size metrics
// Only max makes sense for pre-aggregated size data
const MOBILE_APP_SIZE_AGGREGATIONS: Record<string, Aggregation> = {
  [AggregationKey.MAX]: {
    isSortable: true,
    outputType: null,
    parameters: [
      {
        kind: 'column',
        columnTypes: ['number'],
        defaultValue: 'max_install_size',
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
    'field:max_install_size': {
      label: 'Max Install Size',
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: 'max_install_size', dataType: 'number'},
      },
    },
    'field:max_download_size': {
      label: 'Max Download Size',
      value: {
        kind: FieldValueKind.TAG,
        meta: {name: 'max_download_size', dataType: 'number'},
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
      widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'max(max_install_size)';

    const {start, end, period} = pageFilters.datetime;
    const baseParams: Record<string, any> = {
      dataset: 'preprodSize',
      project: pageFilters.projects,
      environment: pageFilters.environments,
      start: start ? new Date(start).toISOString() : undefined,
      end: end ? new Date(end).toISOString() : undefined,
      statsPeriod: period || (!start && !end ? '14d' : undefined),
      interval: widget.interval || '1d',
      yAxis,
      query: widgetQuery.conditions || '',
    };

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
    return data.map(response => {
      // Filter out time buckets with no data (null, undefined, or 0), creating a continuous line
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

      // Use the aggregate field from the query as the series name
      const aggregate =
        widgetQuery.aggregates?.[0] || widgetQuery.fields?.[0] || 'App Size';
      const seriesName = widgetQuery.name || aggregate;

      return {
        seriesName,
        data: seriesData,
      };
    });
  },
  getSeriesResultType: (
    _data: AppSizeResponse[],
    _widgetQuery: WidgetQuery
  ): Record<string, AggregationOutputType> => {
    // Register both possible aggregates as size_base10 to handle multi-query widgets
    // where different queries may use different size types (install vs download)
    return {
      'max(max_install_size)': 'size_base10',
      'max(max_download_size)': 'size_base10',
    };
  },
  filterAggregateParams,
  handleOrderByReset,
};
