import omit from 'lodash/omit';

import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {MetricsApiResponse, Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getMetricsInterval, getSeriesName} from 'sentry/utils/metrics';
import {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {MetricSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/metricSearchBar';

import {DisplayType, Widget, WidgetQuery} from '../types';
import {getWidgetInterval} from '../utils';

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
  SearchBar: MetricSearchBar,
  handleOrderByReset: handleMetricTableOrderByReset,
  supportedDisplayTypes: [
    DisplayType.AREA,
    DisplayType.BAR,
    DisplayType.BIG_NUMBER,
    DisplayType.LINE,
    DisplayType.TABLE,
    DisplayType.TOP_N,
  ],
  transformSeries: transformMetricsResponseToSeries,
  transformTable: transformMetricsResponseToTable,
  getTableFieldOptions: () => ({}),
  getTimeseriesSortOptions: () => ({}),
  getTableSortOptions: undefined,
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
  const interval = getWidgetInterval(displayType, {start, end, period}, widget.interval);

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

export function transformMetricsResponseToTable(
  data: MetricsApiResponse,
  {aggregates}: WidgetQuery
): TableData {
  // TODO(ddm): get rid of this mapping, it is only needed because the API returns
  // `op(metric_name)` instead of `op(mri)`
  const rows = mapResponse(data, aggregates).groups.map((group, index) => {
    const groupColumn = mapDerivedMetricsToFields(group.by);
    const value = mapDerivedMetricsToFields(group.totals);
    return {
      id: String(index),
      ...groupColumn,
      ...value,
    };
  });

  const singleRow = rows[0];
  const meta = {
    ...changeObjectValuesToTypes(omit(singleRow, 'id')),
  };
  return {meta, data: rows};
}

function mapDerivedMetricsToFields(
  results: Record<string, number | string | null> | undefined,
  mapToKey?: string
) {
  if (!results) {
    return {};
  }

  const mappedResults: typeof results = {};
  for (const [key, value] of Object.entries(results)) {
    mappedResults[mapToKey ?? key] = value;
  }
  return mappedResults;
}

function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.keys(obj ?? {}).reduce((acc, key) => {
    acc[key] = key.includes('@') ? 'number' : 'string';
    return acc;
  }, {});
}

export function transformMetricsResponseToSeries(
  data: MetricsApiResponse,
  widgetQuery: WidgetQuery
) {
  if (data === null) {
    return [];
  }

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
        seriesName: getSeriesName(group, data.groups.length === 1, widgetQuery.columns),
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
  widgetInterval?: string,
  limit?: number,
  cursor?: string
) {
  const {environments, projects, datetime} = pageFilters;
  const {start, end, period} = datetime;

  const columns = query.columns;

  // we use the metrics interval by default, falling back to the widget interval
  const interval = getMetricsInterval(datetime, 'custom') ?? widgetInterval;

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

  return doMetricsRequest(api, requestData) as Promise<
    [MetricsApiResponse, string | undefined, ResponseMeta | undefined]
  >;
}

const mapResponse = (data: MetricsApiResponse, field: string[]): MetricsApiResponse => {
  const mappedGroups = data.groups.map(group => {
    return {
      ...group,
      by: group.by,
      series: swapKeys(group.series, field),
      totals: swapKeys(group.totals, field),
    };
  });

  return {...data, groups: mappedGroups};
};

const swapKeys = (obj: Record<string, unknown> | undefined, newKeys: string[]) => {
  if (!obj) {
    return {};
  }

  const keys = Object.keys(obj);
  const values = Object.values(obj);
  const newObj = {};
  keys.forEach((_, index) => {
    newObj[newKeys[index]] = values[index];
  });
  return newObj;
};
