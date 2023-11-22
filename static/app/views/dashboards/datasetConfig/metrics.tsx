import omit from 'lodash/omit';

import {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {MetricsApiResponse, Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {getMetricsApiRequestQuery, getSeriesName} from 'sentry/utils/metrics';
import {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {MetricSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/metricSearchBar';

import {DisplayType, Widget, WidgetQuery} from '../types';

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
    limit?: number
  ) => getMetricRequest(api, query, organization, pageFilters, limit),
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
  return getMetricRequest(api, query, organization, pageFilters, widget.limit);
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
  api: Client,
  query: WidgetQuery,
  organization: Organization,
  pageFilters: PageFilters,
  limit?: number
) {
  const requestData = getMetricsApiRequestQuery(
    {
      field: query.aggregates[0],
      query: query.conditions,
      groupBy: query.columns,
    },
    pageFilters,
    {
      per_page: query.columns.length === 0 ? 1 : limit,
      useNewMetricsLayer: false,
    }
  );

  const pathname = `/organizations/${organization.slug}/metrics/data/`;

  return api.requestPromise(pathname, {
    includeAllArgs: true,
    query: requestData,
  }) as Promise<[MetricsApiResponse, string | undefined, ResponseMeta | undefined]>;
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
