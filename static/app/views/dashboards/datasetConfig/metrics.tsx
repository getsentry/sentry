import omit from 'lodash/omit';

import type {Client, ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import type {
  MetricsApiResponse,
  Organization,
  PageFilters,
  TagCollection,
} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import type {EventData} from 'sentry/utils/discover/eventView';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {
  getMetricsApiRequestQuery,
  getMetricsSeriesName,
  groupByOp,
} from 'sentry/utils/metrics';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {
  formatMRIField,
  getMRI,
  getUseCaseFromMRI,
  isMRIField,
  parseField,
  parseMRI,
} from 'sentry/utils/metrics/mri';
import type {OnDemandControlContext} from 'sentry/utils/performance/contexts/onDemandControl';
import {MetricSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/metricSearchBar';
import type {FieldValueOption} from 'sentry/views/discover/table/queryField';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {Widget, WidgetQuery} from '../types';
import {DisplayType} from '../types';

import type {DatasetConfig} from './base';
import {handleOrderByReset} from './base';

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
  getCustomFieldRenderer: field => (data: EventData) =>
    renderMetricField(field, data[field]),
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
  getTimeseriesSortOptions: getMetricTimeseriesSortOptions,
  getTableSortOptions: getMetricTableSortOptions,
  filterTableOptions: filterMetricOperations,
  filterYAxisOptions: () => option => filterMetricOperations(option),
  filterAggregateParams: filterMetricMRIs,
  filterYAxisAggregateParams: () => option => filterMetricMRIs(option),
  getGroupByFieldOptions: getTagsForMetric,
  getFieldHeaderMap: getFormattedMRIHeaders,
};

export function renderMetricField(field: string, value: any) {
  const parsedField = parseField(field);
  if (parsedField) {
    const unit = parseMRI(parsedField.mri)?.unit ?? '';
    return <NumberContainer>{formatMetricUsingUnit(value, unit)}</NumberContainer>;
  }
  return value;
}

export function formatMetricAxisValue(field: string, value: number) {
  const unit = parseMRI(parseField(field)?.mri)?.unit ?? '';
  return formatMetricUsingUnit(value, unit);
}

function getFormattedMRIHeaders(query?: WidgetQuery) {
  if (!query) {
    return {};
  }

  return (query.fields || []).reduce((acc, field, index) => {
    const fieldAlias = query.fieldAliases?.[index];
    acc[field] = fieldAlias || formatMRIField(field);
    return acc;
  }, {});
}

function getMetricTimeseriesSortOptions(_, widgetQuery: WidgetQuery) {
  if (!widgetQuery.fields?.[0]) {
    return [];
  }

  return widgetQuery.fields.reduce((acc, field) => {
    if (!isMRIField(field)) {
      return acc;
    }
    return {
      ...acc,
      [`field:${field}`]: {
        label: formatMRIField(field),
        value: {
          kind: FieldValueKind.FIELD,
          value: field,
          meta: {
            name: field,
            dataType: 'number',
          },
        },
      },
    };
  }, {});
}

function getMetricTableSortOptions(_, widgetQuery: WidgetQuery) {
  if (!widgetQuery.fields?.[0]) {
    return [];
  }

  return widgetQuery.fields
    .map((field, i) => {
      const alias = widgetQuery.fieldAliases?.[i];

      return {
        label: alias || formatMRIField(field),
        value: field,
      };
    })
    .filter(option => isMRIField(option.value));
}

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
      const typesByOp: Record<string, Set<string>> = Object.entries(groupedByOp).reduce(
        (acc, [operation, fields]) => {
          const types = new Set();
          fields.forEach(field => types.add(field.type));
          acc[operation] = types;
          return acc;
        },
        {}
      );

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
                  columnTypes: [...typesByOp[operation]],
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
  const mri = getMRI(field);
  const useCase = getUseCaseFromMRI(mri);

  return api
    .requestPromise(`/organizations/${organization.slug}/metrics/tags/`, {
      query: {metric: mri, useCase},
    })
    .then(tagsResponse => {
      tagsResponse.forEach(tag => {
        fieldOptions[`field:${tag.key}`] = {
          label: tag.key,
          value: {
            kind: FieldValueKind.TAG,
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
  return getMetricRequest(
    api,
    query,
    organization,
    pageFilters,
    widget.limit,
    widget.displayType
  );
}

function handleMetricTableOrderByReset(widgetQuery: WidgetQuery, newFields: string[]) {
  const disableSortBy = widgetQuery.columns.includes('session.status');
  if (disableSortBy) {
    widgetQuery.orderby = '';
  }
  return handleOrderByReset(widgetQuery, newFields);
}

export function transformMetricsResponseToTable(data: MetricsApiResponse): TableData {
  const rows = data.groups.map((group, index) => {
    const groupColumn = mapMetricGroupsToFields(group.by);
    const value = mapMetricGroupsToFields(group.totals);
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

function mapMetricGroupsToFields(
  results: Record<string, number | string | null> | undefined
) {
  if (!results) {
    return {};
  }

  const mappedResults: typeof results = {};
  for (const [key, value] of Object.entries(results)) {
    mappedResults[key] = value;
  }
  return mappedResults;
}

function changeObjectValuesToTypes(
  obj: Record<string, number | string | null> | undefined
) {
  return Object.entries(obj ?? {}).reduce((acc, [key, value]) => {
    acc[key] = typeof value;
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
  const queryAlias = widgetQuery.name;

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
        seriesName: queryAlias || getMetricsSeriesName(group),
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
  limit?: number,
  displayType?: DisplayType
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
      query: query.conditions || undefined,
      groupBy: query.columns || undefined,
      orderBy: query.orderby || undefined,
    },
    pageFilters,
    {
      limit: limit || undefined,
      fidelity: displayType === DisplayType.BAR ? 'low' : 'high',
    }
  );

  const pathname = `/organizations/${organization.slug}/metrics/data/`;

  return api.requestPromise(pathname, {
    includeAllArgs: true,
    query: requestData,
  });
}
