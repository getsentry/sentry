import omit from 'lodash/omit';
import trimStart from 'lodash/trimStart';

import {doReleaseHealthRequest} from 'sentry/actionCreators/metrics';
import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {PageFilters, SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import type {SessionsMeta} from 'sentry/types/sessions';
import {SessionField} from 'sentry/types/sessions';
import {defined} from 'sentry/utils';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {statsPeriodToDays} from 'sentry/utils/duration/statsPeriodToDays';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {Widget, WidgetQuery} from '../types';
import {DisplayType} from '../types';
import {getWidgetInterval} from '../utils';
import {getSeriesName} from '../utils/transformSessionsResponseToSeries';
import {
  changeObjectValuesToTypes,
  getDerivedMetrics,
  mapDerivedMetricsToFields,
} from '../utils/transformSessionsResponseToTable';
import {ReleaseSearchBar} from '../widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
  FIELD_TO_METRICS_EXPRESSION,
  generateReleaseWidgetFieldOptions,
  SESSIONS_FIELDS,
  SESSIONS_TAGS,
  TAG_SORT_DENY_LIST,
} from '../widgetBuilder/releaseWidget/fields';
import {
  derivedMetricsToField,
  requiresCustomReleaseSorting,
  resolveDerivedStatusFields,
} from '../widgetCard/releaseWidgetQueries';

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

const METRICS_BACKED_SESSIONS_START_DATE = new Date('2022-07-12');

export const ReleasesConfig: DatasetConfig<SessionApiResponse, SessionApiResponse> = {
  defaultField: DEFAULT_FIELD,
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
  disableSortOptions,
  getTableRequest: (
    api: Client,
    _: Widget,
    query: WidgetQuery,
    organization: Organization,
    pageFilters: PageFilters,
    __?: OnDemandControlContext,
    limit?: number,
    cursor?: string
  ) =>
    getReleasesRequest(
      0,
      1,
      api,
      query,
      organization,
      pageFilters,
      undefined,
      limit,
      cursor
    ),
  getSeriesRequest: getReleasesSeriesRequest,
  getTableSortOptions,
  getTimeseriesSortOptions,
  filterTableOptions: filterPrimaryReleaseTableOptions,
  filterAggregateParams,
  filterYAxisAggregateParams: (_fieldValue: QueryFieldValue, _displayType: DisplayType) =>
    filterAggregateParams,
  filterYAxisOptions,
  getCustomFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
  SearchBar: ReleaseSearchBar,
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

function getReleasesSeriesRequest(
  api: Client,
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters
) {
  const query = widget.queries[queryIndex]!;
  const {displayType, limit} = widget;

  const {datetime} = pageFilters;
  const {start, end, period} = datetime;

  const isCustomReleaseSorting = requiresCustomReleaseSorting(query);

  const includeTotals = query.columns.length > 0 ? 1 : 0;
  const interval = getWidgetInterval(
    displayType,
    {start, end, period},
    '5m',
    // requesting medium fidelity for release sort because metrics api can't return 100 rows of high fidelity series data
    isCustomReleaseSorting ? 'medium' : undefined
  );

  return getReleasesRequest(
    1,
    includeTotals,
    api,
    query,
    organization,
    pageFilters,
    interval,
    limit
  );
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

export function transformSessionsResponseToSeries(
  data: SessionApiResponse,
  widgetQuery: WidgetQuery
) {
  if (data === null) {
    return [];
  }

  const queryAlias = widgetQuery.name;

  const useSessionAPI = widgetQuery.columns.includes('session.status');
  const {derivedStatusFields: requestedStatusMetrics, injectedFields} =
    resolveDerivedStatusFields(
      widgetQuery.aggregates,
      widgetQuery.orderby,
      useSessionAPI
    );

  const results: Series[] = [];

  if (!data.groups.length) {
    return [
      {
        seriesName: `(${t('no results')})`,
        data: data.intervals.map(interval => ({
          name: interval,
          value: 0,
        })),
      },
    ];
  }

  data.groups.forEach(group => {
    Object.keys(group.series).forEach(field => {
      // if `sum(session)` or `count_unique(user)` are not
      // requested as a part of the payload for
      // derived status metrics through the Sessions API,
      // they are injected into the payload and need to be
      // stripped.
      if (!injectedFields.includes(derivedMetricsToField(field))) {
        results.push({
          seriesName: getSeriesName(field, group, queryAlias),
          data: data.intervals.map((interval, index) => ({
            name: interval,
            value: group.series[field]?.[index] ?? 0,
          })),
        });
      }
    });
    // if session.status is a groupby, some post processing
    // is needed to calculate the status derived metrics
    // from grouped results of `sum(session)` or `count_unique(user)`
    if (requestedStatusMetrics.length && defined(group.by['session.status'])) {
      requestedStatusMetrics.forEach(status => {
        const result = status.match(DERIVED_STATUS_METRICS_PATTERN);
        if (result) {
          let metricField: string | undefined = undefined;
          if (group.by['session.status'] === result[1]) {
            if (result[2] === 'session') {
              metricField = 'sum(session)';
            } else if (result[2] === 'user') {
              metricField = 'count_unique(user)';
            }
          }
          results.push({
            seriesName: getSeriesName(status, group, queryAlias),
            data: data.intervals.map((interval, index) => ({
              name: interval,
              value: metricField ? group.series[metricField]?.[index] ?? 0 : 0,
            })),
          });
        }
      });
    }
  });

  return results;
}

function fieldsToDerivedMetrics(field: string): string {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return FIELD_TO_METRICS_EXPRESSION[field] ?? field;
}

function getReleasesRequest(
  includeSeries: number,
  includeTotals: number,
  api: Client,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  interval?: string,
  limit?: number,
  cursor?: string
) {
  const {environments, projects, datetime} = pageFilters;
  const {start, end, period} = datetime;

  let showIncompleteDataAlert = false;

  if (start) {
    let startDate: Date | undefined = undefined;
    if (typeof start === 'string') {
      startDate = new Date(start);
    } else {
      startDate = start;
    }
    showIncompleteDataAlert = startDate < METRICS_BACKED_SESSIONS_START_DATE;
  } else if (period) {
    const periodInDays = statsPeriodToDays(period);
    const current = new Date();
    const prior = new Date(new Date().setDate(current.getDate() - periodInDays));
    showIncompleteDataAlert = prior < METRICS_BACKED_SESSIONS_START_DATE;
  }

  if (showIncompleteDataAlert) {
    return Promise.reject(
      new Error(
        t(
          'Releases data is only available from Jul 12. Please retry your query with a more recent date range.'
        )
      )
    );
  }

  // Only time we need to use sessions API is when session.status is requested
  // as a group by.
  const useSessionAPI = query.columns.includes('session.status');
  const isCustomReleaseSorting = requiresCustomReleaseSorting(query);
  const isDescending = query.orderby.startsWith('-');
  const rawOrderby = trimStart(query.orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';
  const columns = query.columns;

  // Temporary solution to support sorting on releases when querying the
  // Metrics API:
  //
  // We first request the top 50 recent releases from postgres. Note that the
  // release request is based on the project and environment selected in the
  // page filters.
  //
  // We then construct a massive OR condition and append it to any specified
  // filter condition. We also maintain an ordered array of release versions
  // to order the results returned from the metrics endpoint.
  //
  // Also note that we request a limit of 100 on the metrics endpoint, this
  // is because in a query, the limit should be applied after the results are
  // sorted based on the release version. The larger number of rows we
  // request, the more accurate our results are going to be.
  //
  // After the results are sorted, we truncate the data to the requested
  // limit. This will result in a few edge cases:
  //
  //   1. low to high sort may not show releases at the beginning of the
  //      selected period if there are more than 50 releases in the selected
  //      period.
  //
  //   2. if a recent release is not returned due to the 100 row limit
  //      imposed on the metrics query the user won't see it on the
  //      table/chart/
  //

  const {aggregates, injectedFields} = resolveDerivedStatusFields(
    query.aggregates,
    query.orderby,
    useSessionAPI
  );
  let requestData: any;
  let requester: any;
  if (useSessionAPI) {
    const sessionAggregates = aggregates.filter(
      agg => !Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
    );
    requestData = {
      field: sessionAggregates,
      orgSlug: organization.slug,
      end,
      environment: environments,
      groupBy: columns,
      limit: undefined,
      orderBy: '', // Orderby not supported with session.status
      interval,
      project: projects,
      query: query.conditions,
      start,
      statsPeriod: period,
      includeAllArgs: true,
      cursor,
    };
    requester = doSessionsRequest;
  } else {
    requestData = {
      field: aggregates.map(fieldsToDerivedMetrics),
      orgSlug: organization.slug,
      end,
      environment: environments,
      groupBy: columns.map(fieldsToDerivedMetrics),
      limit: columns.length === 0 ? 1 : isCustomReleaseSorting ? 100 : limit,
      orderBy: unsupportedOrderby
        ? ''
        : isDescending
          ? `-${fieldsToDerivedMetrics(rawOrderby)}`
          : fieldsToDerivedMetrics(rawOrderby),
      interval,
      project: projects,
      query: query.conditions,
      start,
      statsPeriod: period,
      includeAllArgs: true,
      cursor,
      includeSeries,
      includeTotals,
    };
    requester = doReleaseHealthRequest;

    if (
      rawOrderby &&
      !unsupportedOrderby &&
      !aggregates.includes(rawOrderby) &&
      !columns.includes(rawOrderby)
    ) {
      requestData.field = [...requestData.field, fieldsToDerivedMetrics(rawOrderby)];
      if (!injectedFields.includes(rawOrderby)) {
        injectedFields.push(rawOrderby);
      }
    }
  }

  return requester(api, requestData);
}
