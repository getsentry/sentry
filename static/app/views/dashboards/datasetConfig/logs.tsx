import pickBy from 'lodash/pickBy';

import type {TagCollection} from 'sentry/types/group';
import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
  Organization,
} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Aggregation, QueryFieldValue} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
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
import {DisplayType, type WidgetQuery} from 'sentry/views/dashboards/types';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {
  useLogsSeriesQuery,
  useLogsTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useLogsWidgetQuery';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {generateFieldOptions} from 'sentry/views/discover/utils';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  useTraceItemAttributes,
  useTraceItemAttributesWithConfig,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {isLogsEnabled} from 'sentry/views/explore/logs/isLogsEnabled';
import {LOG_AGGREGATES} from 'sentry/views/explore/logs/logsToolbar';
import {TraceItemDataset} from 'sentry/views/explore/types';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: ['count()'],
  columns: [],
  fieldAliases: [],
  aggregates: ['count()'],
  conditions: '',
  orderby: '-count()',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: ['count', '', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

const EAP_AGGREGATIONS = LOG_AGGREGATES.map(
  (x: {value: AggregationKey}) => x.value
).reduce(
  (acc: Record<AggregationKey, Aggregation>, aggregate: AggregationKey) => {
    if (aggregate === AggregationKey.COUNT) {
      acc[AggregationKey.COUNT] = {
        isSortable: true,
        outputType: null,
        parameters: [],
      };
    } else if (aggregate === AggregationKey.COUNT_UNIQUE) {
      acc[AggregationKey.COUNT_UNIQUE] = {
        isSortable: true,
        outputType: null,
        parameters: [
          {
            kind: 'column',
            columnTypes: ['number', 'string'],
            defaultValue: 'message.template',
            required: true,
          },
        ],
      };
    } else {
      acc[aggregate] = {
        isSortable: true,
        outputType: null,
        parameters: [
          {
            kind: 'column',
            columnTypes: ['number', 'string'], // Need to keep the string type for unknown values before tags are resolved
            defaultValue: 'severity_number',
            required: true,
          },
        ],
      };
    }
    return acc;
  },
  {} as Record<AggregationKey, Aggregation>
);

function LogsSearchBar({
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
      itemType={TraceItemDataset.LOGS}
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

function useLogsSearchBarDataProvider(props: SearchBarDataProviderProps): SearchBarData {
  const {pageFilters, widgetQuery} = props;
  const organization = useOrganization();

  const traceItemAttributeConfig = {
    traceItemType: TraceItemDataset.LOGS,
    enabled: isLogsEnabled(organization),
  };

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributesWithConfig(traceItemAttributeConfig, 'number');

  const {filterKeys, filterKeySections, getTagValues} =
    useTraceItemSearchQueryBuilderProps({
      itemType: TraceItemDataset.LOGS,
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

export const LogsConfig: DatasetConfig<
  EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats,
  TableData | EventsTableData
> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  SearchBar: LogsSearchBar,
  useSearchBarDataProvider: useLogsSearchBarDataProvider,
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
  useSeriesQuery: useLogsSeriesQuery,
  useTableQuery: useLogsTableQuery,
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
  const baseFieldOptions = generateFieldOptions({
    organization,
    tagKeys: [],
    fieldKeys: [],
    aggregations: EAP_AGGREGATIONS,
  });

  const logTags = Object.values(tags ?? {}).reduce<Record<string, FieldValueOption>>(
    (acc, tag) => {
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
    {}
  );

  return {...baseFieldOptions, ...logTags};
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
    return true; // COUNT() doesn't need parameters for logs
  }

  const expectedDataTypes =
    fieldValue?.kind === 'function' &&
    fieldValue?.function[0] === AggregationKey.COUNT_UNIQUE
      ? new Set(['number', 'string'])
      : new Set(['number']);

  if ('dataType' in option.value.meta) {
    return expectedDataTypes.has(option.value.meta.dataType);
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
    if (option.value.kind === FieldValueKind.FUNCTION) {
      return true;
    }

    return columns.has(option.value.meta.name);
  };
}
