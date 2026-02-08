import omit from 'lodash/omit';

import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import type {SessionsMeta} from 'sentry/types/sessions';
import {SessionField} from 'sentry/types/sessions';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import {transformSessionsResponseToSeries} from 'sentry/views/dashboards/utils/transformSessionsResponseToSeries';
import {
  changeObjectValuesToTypes,
  getDerivedMetrics,
  mapDerivedMetricsToFields,
} from 'sentry/views/dashboards/utils/transformSessionsResponseToTable';
import {
  ReleaseSearchBar,
  useReleasesSearchBarDataProvider,
} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar';
import {
  DISABLED_SORT,
  generateReleaseWidgetFieldOptions,
  SESSIONS_FIELDS,
  SESSIONS_TAGS,
  TAG_SORT_DENY_LIST,
} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';
import {
  useReleasesSeriesQuery,
  useReleasesTableQuery,
} from 'sentry/views/dashboards/widgetCard/hooks/useReleasesWidgetQuery';
import {resolveDerivedStatusFields} from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {DatasetConfig} from './base';
import {handleOrderByReset} from './base';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: [`crash_free_rate(${SessionField.SESSION})`],
  columns: [],
  fieldAliases: [],
  aggregates: [`crash_free_rate(${SessionField.SESSION})`],
  conditions: '',
  orderby: `-crash_free_rate(${SessionField.SESSION})`,
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: [
    'crash_free_rate' as AggregationKeyWithAlias,
    SessionField.SESSION,
    undefined,
    undefined,
  ],
  kind: FieldValueKind.FUNCTION,
};

export const ReleasesConfig: DatasetConfig<SessionApiResponse, SessionApiResponse> = {
  defaultCategoryField: 'release',
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  disableSortOptions,
  useTableQuery: useReleasesTableQuery,
  useSeriesQuery: useReleasesSeriesQuery,
  getTableSortOptions,
  getTimeseriesSortOptions,
  filterTableOptions: filterPrimaryReleaseTableOptions,
  filterAggregateParams,
  filterYAxisAggregateParams: (_fieldValue: QueryFieldValue, _displayType: DisplayType) =>
    filterAggregateParams,
  filterYAxisOptions,
  getCustomFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
  SearchBar: ReleaseSearchBar,
  useSearchBarDataProvider: useReleasesSearchBarDataProvider,
  getTableFieldOptions: getReleasesTableFieldOptions,
  getGroupByFieldOptions: (_organization: Organization) =>
    generateReleaseWidgetFieldOptions([] as SessionsMeta[], SESSIONS_TAGS),
  handleColumnFieldChangeOverride,
  handleOrderByReset: handleReleasesTableOrderByReset,
  filterSeriesSortOptions,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.BIG_NUMBER,
    DisplayType.CATEGORICAL_BAR,
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
  ],
  transformSeries: transformSessionsResponseToSeries,
  transformTable: transformSessionsResponseToTable,
};

function disableSortOptions(widgetQuery: WidgetQuery) {
  const {columns} = widgetQuery;
  if (columns.includes('session.status')) {
    return {
      disableSort: true,
      disableSortDirection: true,
      disableSortReason: t('Sorting currently not supported with session.status'),
    };
  }
  return {
    disableSort: false,
    disableSortDirection: false,
  };
}

function getTableSortOptions(_organization: Organization, widgetQuery: WidgetQuery) {
  const {columns, aggregates} = widgetQuery;
  const options: Array<SelectValue<string>> = [];
  [...aggregates, ...columns]
    .filter(field => !!field)
    .filter(field => !DISABLED_SORT.includes(field))
    .filter(field => !TAG_SORT_DENY_LIST.includes(field))
    .forEach(field => {
      options.push({label: field, value: field});
    });

  return options;
}

function getTimeseriesSortOptions(_organization: Organization, widgetQuery: WidgetQuery) {
  const columnSet = new Set(widgetQuery.columns);
  const releaseFieldOptions = generateReleaseWidgetFieldOptions(
    Object.values(SESSIONS_FIELDS),
    SESSIONS_TAGS
  );
  const options: Record<string, SelectValue<FieldValue>> = {};
  Object.entries(releaseFieldOptions).forEach(([key, option]) => {
    if (['count_healthy', 'count_errored'].includes(option.value.meta.name)) {
      return;
    }
    if (option.value.kind === FieldValueKind.FIELD) {
      // Only allow sorting by release tag
      if (option.value.meta.name === 'release' && columnSet.has(option.value.meta.name)) {
        options[key] = option;
      }
      return;
    }
    options[key] = option;
  });
  return options;
}

function filterSeriesSortOptions(columns: Set<string>) {
  return (option: FieldValueOption) => {
    if (['count_healthy', 'count_errored'].includes(option.value.meta.name)) {
      return false;
    }
    if (option.value.kind === FieldValueKind.FIELD) {
      // Only allow sorting by release tag
      return columns.has(option.value.meta.name) && option.value.meta.name === 'release';
    }
    return filterPrimaryReleaseTableOptions(option);
  };
}

function filterPrimaryReleaseTableOptions(option: FieldValueOption) {
  return [
    FieldValueKind.FUNCTION,
    FieldValueKind.FIELD,
    FieldValueKind.NUMERIC_METRICS,
  ].includes(option.value.kind);
}

function filterAggregateParams(option: FieldValueOption) {
  return option.value.kind === FieldValueKind.METRICS;
}

function filterYAxisOptions(_displayType: DisplayType) {
  return (option: FieldValueOption) => {
    return [FieldValueKind.FUNCTION, FieldValueKind.NUMERIC_METRICS].includes(
      option.value.kind
    );
  };
}

function handleReleasesTableOrderByReset(widgetQuery: WidgetQuery, newFields: string[]) {
  const disableSortBy = widgetQuery.columns.includes('session.status');
  if (disableSortBy) {
    widgetQuery.orderby = '';
  }
  return handleOrderByReset(widgetQuery, newFields);
}

function handleColumnFieldChangeOverride(widgetQuery: WidgetQuery): WidgetQuery {
  if (widgetQuery.aggregates.length === 0) {
    // Release Health widgets require an aggregate in tables
    const defaultReleaseHealthAggregate = `crash_free_rate(${SessionField.SESSION})`;
    widgetQuery.aggregates = [defaultReleaseHealthAggregate];
    widgetQuery.fields = widgetQuery.fields
      ? [...widgetQuery.fields, defaultReleaseHealthAggregate]
      : [defaultReleaseHealthAggregate];
  }
  return widgetQuery;
}

function getReleasesTableFieldOptions(_organization: Organization) {
  return generateReleaseWidgetFieldOptions(Object.values(SESSIONS_FIELDS), SESSIONS_TAGS);
}

/** @internal exported for tests **/
export function transformSessionsResponseToTable(
  data: SessionApiResponse,
  widgetQuery: WidgetQuery
): TableData {
  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {derivedStatusFields, injectedFields} = resolveDerivedStatusFields(
    widgetQuery.aggregates,
    widgetQuery.orderby,
    useSessionAPI
  );
  const rows = data.groups.map((group, index) => ({
    id: String(index),
    // @ts-expect-error TS(2345): Argument of type 'Record<string, string | number> ... Remove this comment to see the full error message
    ...mapDerivedMetricsToFields(group.by),
    // if `sum(session)` or `count_unique(user)` are not
    // requested as a part of the payload for
    // derived status metrics through the Sessions API,
    // they are injected into the payload and need to be
    // stripped.
    ...omit(mapDerivedMetricsToFields(group.totals), injectedFields),
    // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`
    ...getDerivedMetrics(group.by, group.totals, derivedStatusFields),
  }));

  const singleRow = rows[0];
  const meta = {
    ...changeObjectValuesToTypes(omit(singleRow, 'id')),
    fields: changeObjectValuesToTypes(omit(singleRow, 'id')),
  };
  return {meta, data: rows};
}
