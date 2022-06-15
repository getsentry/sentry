import omit from 'lodash/omit';
import trimStart from 'lodash/trimStart';

import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import {t} from 'sentry/locale';
import {MetricsApiResponse, SessionApiResponse, SessionField} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

import {DisplayType, WidgetQuery} from '../types';
import {getWidgetInterval} from '../utils';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
  FIELD_TO_METRICS_EXPRESSION,
  generateReleaseWidgetFieldOptions,
  SESSIONS_FIELDS,
  SESSIONS_TAGS,
} from '../widgetBuilder/releaseWidget/fields';
import {
  derivedMetricsToField,
  requiresCustomReleaseSorting,
  resolveDerivedStatusFields,
} from '../widgetCard/releaseWidgetQueries';
import {getSeriesName} from '../widgetCard/transformSessionsResponseToSeries';
import {
  changeObjectValuesToTypes,
  getDerivedMetrics,
  mapDerivedMetricsToFields,
} from '../widgetCard/transformSessionsResponseToTable';

import {ContextualProps, DatasetConfig} from './base';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: [`crash_free_rate(${SessionField.SESSION})`],
  columns: [],
  fieldAliases: [],
  aggregates: [`crash_free_rate(${SessionField.SESSION})`],
  conditions: '',
  orderby: `-crash_free_rate(${SessionField.SESSION})`,
};

export const ReleasesConfig: DatasetConfig<
  SessionApiResponse | MetricsApiResponse,
  SessionApiResponse | MetricsApiResponse
> = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  getTableRequest,
  getCustomFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
  getTableFieldOptions: getReleasesTableFieldOptions,
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

function getReleasesTableFieldOptions() {
  return generateReleaseWidgetFieldOptions(Object.values(SESSIONS_FIELDS), SESSIONS_TAGS);
}

export function transformSessionsResponseToTable(
  data: SessionApiResponse | MetricsApiResponse,
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
  };
  return {meta, data: rows};
}

export function transformSessionsResponseToSeries(
  data: SessionApiResponse | MetricsApiResponse,
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
      if (!!!injectedFields.includes(derivedMetricsToField(field))) {
        results.push({
          seriesName: getSeriesName(field, group, queryAlias),
          data: data.intervals.map((interval, index) => ({
            name: interval,
            value: group.series[field][index] ?? 0,
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
              value: metricField ? group.series[metricField][index] ?? 0 : 0,
            })),
          });
        }
      });
    }
  });

  return results;
}

function fieldsToDerivedMetrics(field: string): string {
  return FIELD_TO_METRICS_EXPRESSION[field] ?? field;
}

function getTableRequest(
  query: WidgetQuery,
  contextualProps?: ContextualProps,
  limit?: number,
  cursor?: string
) {
  const {environments, projects, datetime} = contextualProps!.pageFilters!;
  const {start, end, period} = datetime;

  // Only time we need to use sessions API is when session.status is requested
  // as a group by.
  const useSessionAPI = query.columns.includes('session.status');
  const isCustomReleaseSorting = requiresCustomReleaseSorting(query);
  const isDescending = query.orderby.startsWith('-');
  const rawOrderby = trimStart(query.orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';
  const columns = query.columns;
  const includeSeries = 0;
  const includeTotals = 1;

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

  const interval = getWidgetInterval(
    DisplayType.TABLE,
    {start, end, period},
    '5m',
    // requesting low fidelity for release sort because metrics api can't return 100 rows of high fidelity series data
    isCustomReleaseSorting ? 'low' : undefined
  );

  const {aggregates, injectedFields} = resolveDerivedStatusFields(
    query.aggregates,
    query.orderby,
    useSessionAPI
  );
  let requestData;
  let requester;
  if (useSessionAPI) {
    const sessionAggregates = aggregates.filter(
      agg => !!!Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
    );
    requestData = {
      field: sessionAggregates,
      orgSlug: contextualProps?.organization?.slug,
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
      orgSlug: contextualProps?.organization?.slug,
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
    requester = doMetricsRequest;

    if (
      rawOrderby &&
      !!!unsupportedOrderby &&
      !!!aggregates.includes(rawOrderby) &&
      !!!columns.includes(rawOrderby)
    ) {
      requestData.field = [...requestData.field, fieldsToDerivedMetrics(rawOrderby)];
      if (!!!injectedFields.includes(rawOrderby)) {
        injectedFields.push(rawOrderby);
      }
    }
  }

  return requester(contextualProps!.api, requestData);
}
