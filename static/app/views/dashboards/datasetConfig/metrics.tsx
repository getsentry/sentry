import omit from 'lodash/omit';

import {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {MetricsApiResponse, Organization, PageFilters, TagCollection} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  fieldToMri,
  getMetricsApiRequestQuery,
  getSeriesName,
  getUseCaseFromMRI,
  groupByOp,
} from 'sentry/utils/metrics';
import {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {MetricSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/metricSearchBar';
import {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import {DisplayType, Widget, WidgetQuery} from '../types';

import {DatasetConfig, handleOrderByReset} from './base';

const DEFAULT_WIDGET_QUERY: WidgetQuery = {
  name: '',
  fields: [''],
  columns: [''],
  fieldAliases: [],
  aggregates: [''],
  conditions: '',
  orderby: '',
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
  getTableFieldOptions: getFields,
  getTimeseriesSortOptions: () => ({}),
  getTableSortOptions: () => [],
  filterTableOptions: filterMetricOperations,
  filterYAxisOptions: () => {
    return (option: FieldValueOption) => filterMetricOperations(option);
  },
  filterAggregateParams: filterMetricMRIs,
  filterYAxisAggregateParams: () => {
    return (option: FieldValueOption) => filterMetricMRIs(option);
  },
  getGroupByFieldOptions: getTagsForMetric,
};

function getFields(
  organization: Organization,
  _?: TagCollection | undefined,
  __?: CustomMeasurementCollection,
  api?: Client
) {
  if (!api) {
    return {};
  }

  return api
    .requestPromise(`/organizations/${organization.slug}/metrics/meta/`, {
      query: {useCase: 'custom'},
    })
    .then(metaReponse => {
      const groupedByOp = groupByOp(metaReponse);

      const fieldOptions: Record<string, any> = {};
      Object.entries(groupedByOp).forEach(([operation, fields]) => {
        fieldOptions[`function:${operation}`] = {
          label: `${operation}(${'\u2026'})`,
          value: {
            kind: FieldValueKind.FUNCTION,
            meta: {
              name: operation,
              parameters: [
                {
                  kind: 'column',
                  columnTypes: [fields[0].type],
                  defaultValue: fields[0].mri,
                  required: true,
                },
              ],
            },
          },
        };
      });

      metaReponse
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach(field => {
          fieldOptions[`field:${field.mri}`] = {
            label: field.name,
            value: {
              kind: FieldValueKind.METRICS,
              meta: {
                name: field.mri,
                dataType: field.type,
              },
            },
          };
        });

      return fieldOptions;
    });
}

function filterMetricOperations(option: FieldValueOption) {
  return option.value.kind === FieldValueKind.FUNCTION;
}

function filterMetricMRIs(option: FieldValueOption) {
  return option.value.kind === FieldValueKind.METRICS;
}

function getTagsForMetric(
  organization: Organization,
  _?: TagCollection,
  __?: CustomMeasurementCollection,
  api?: Client,
  queries?: WidgetQuery[]
) {
  const fieldOptions = {};

  if (!api) {
    return fieldOptions;
  }
  const field = queries?.[0].aggregates[0] ?? '';
  const {mri} = fieldToMri(field);
  const useCase = getUseCaseFromMRI(mri);

  if (!mri) {
    return fieldOptions;
  }

  return api
    .requestPromise(`/organizations/${organization.slug}/metrics/tags/`, {
      query: {metric: mri, useCase},
    })
    .then(tagsResponse => {
      tagsResponse.forEach(tag => {
        fieldOptions[`field:${tag.key}`] = {
          label: tag.key,
          value: {
            kind: FieldValueKind.FIELD,
            meta: {name: tag.key, dataType: 'string'},
          },
        };
      });
      return fieldOptions;
    });
}

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
): Promise<[MetricsApiResponse, string | undefined, ResponseMeta | undefined]> {
  if (!query.aggregates[0]) {
    // No aggregate selected, return empty response
    return Promise.resolve([
      {
        intervals: [],
        groups: [],
        meta: [],
      },
      'OK',
      {
        getResponseHeader: () => '',
      },
    ] as any);
  }

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
  });
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
