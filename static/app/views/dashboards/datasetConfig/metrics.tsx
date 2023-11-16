import omit from 'lodash/omit';

import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {
  MetricsApiResponse,
  Organization,
  PageFilters,
  SessionApiResponse,
  SessionField,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {ReleaseSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/releaseSearchBar';

import {DisplayType, Widget, WidgetQuery} from '../types';
import {getWidgetInterval} from '../utils';
import {resolveDerivedStatusFields} from '../widgetCard/metricWidgetQueries';
import {getSeriesName} from '../widgetCard/transformSessionsResponseToSeries';
import {
  changeObjectValuesToTypes,
  getDerivedMetrics,
  mapDerivedMetricsToFields,
} from '../widgetCard/transformSessionsResponseToTable';

import {DatasetConfig, handleOrderByReset} from './base';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: [`avg(duration)`],
  columns: [],
  fieldAliases: [],
  aggregates: [`avg(duration)`],
  conditions: '',
  orderby: `-avg(duration)`,
};

export const MetricsConfig: DatasetConfig<MetricsApiResponse, MetricsApiResponse> = {
  defaultWidgetQuery: DEFAULT_WIDGET_QUERY,
  enableEquations: false,
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
    getMetricRequest(
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
  getSeriesRequest: getMetricSeriesRequest,
  getCustomFieldRenderer: (field, meta) => getFieldRenderer(field, meta, false),
  // TODO(ddm): check if we need a MetricSearchBar
  SearchBar: ReleaseSearchBar,
  handleColumnFieldChangeOverride,
  handleOrderByReset: handleMetricTableOrderByReset,
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
  getTableFieldOptions: () => ({}),
};

function getMetricSeriesRequest(
  api: Client,
  widget: Widget,
  queryIndex: number,
  organization: Organization,
  pageFilters: PageFilters
) {
  const query = widget.queries[queryIndex];
  const {displayType, limit} = widget;

  const {datetime} = pageFilters;
  const {start, end, period} = datetime;

  const includeTotals = query.columns.length > 0 ? 1 : 0;
  const interval = getWidgetInterval(
    displayType,
    {start, end, period},
    '5m'
    // requesting low fidelity for release sort because metrics api can't return 100 rows of high fidelity series data
  );

  return getMetricRequest(
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

function handleMetricTableOrderByReset(widgetQuery: WidgetQuery, newFields: string[]) {
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

export function transformSessionsResponseToTable(
  data: SessionApiResponse | MetricsApiResponse,
  widgetQuery: WidgetQuery
): TableData {
  const {derivedStatusFields, injectedFields} = resolveDerivedStatusFields(
    widgetQuery.aggregates
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
      results.push({
        seriesName: getSeriesName(field, group, queryAlias),
        data: data.intervals.map((interval, index) => ({
          name: interval,
          value: group.series[field][index] ?? 0,
        })),
      });
    });
  });

  return results;
}

function getMetricRequest(
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

  const columns = query.columns;

  const requestData = {
    field: query.aggregates,
    orgSlug: organization.slug,
    end,
    environment: environments,
    groupBy: columns,
    limit: columns.length === 0 ? 1 : limit,
    orderBy: '',
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

  // TODO(ddm): get rid of this cast
  return doMetricsRequest(api, requestData) as Promise<
    [MetricsApiResponse, string | undefined, ResponseMeta | undefined]
  >;
}
