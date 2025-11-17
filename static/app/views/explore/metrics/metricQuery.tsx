import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isBaseVisualize,
  isVisualize,
  Visualize,
  VisualizeFunction,
  type BaseVisualize,
} from 'sentry/views/explore/queryParams/visualize';

export interface TraceMetric {
  name: string;
  type: string;
}

export interface BaseMetricQuery {
  metric: TraceMetric;
  queryParams: ReadableQueryParams;
}

export interface MetricQuery extends BaseMetricQuery {
  removeMetric: () => void;
  setQueryParams: (queryParams: ReadableQueryParams) => void;
  setTraceMetric: (traceMetric: TraceMetric) => void;
}

export function decodeMetricsQueryParams(value: string): BaseMetricQuery | null {
  let json: any;
  try {
    json = JSON.parse(value);
  } catch {
    return null;
  }

  const metric = json.metric;
  if (defined(metric) && typeof metric !== 'object') {
    return null;
  }

  const query = json.query;
  if (typeof query !== 'string') {
    return null;
  }

  const rawAggregateFields = json.aggregateFields;
  if (!Array.isArray(rawAggregateFields)) {
    return null;
  }

  const visualizes = rawAggregateFields
    .filter<BaseVisualize>(isBaseVisualize)
    .flatMap(vis => Visualize.fromJSON(vis));

  if (!visualizes.length) {
    return null;
  }

  const groupBys = rawAggregateFields.filter<GroupBy>(isGroupBy);

  const aggregateFields = [...visualizes, ...groupBys];

  const aggregateSortBys = json.aggregateSortBys;
  if (!Array.isArray(aggregateSortBys)) {
    return null;
  }

  return {
    metric,
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: json.mode,
      query,

      cursor: '',
      fields: defaultFields(),
      sortBys: defaultSortBys(defaultFields()),

      aggregateCursor: '',
      aggregateFields,
      aggregateSortBys,
    }),
  };
}

export function encodeMetricQueryParams(metricQuery: BaseMetricQuery): string {
  return JSON.stringify({
    metric: metricQuery.metric,
    query: metricQuery.queryParams.query,
    aggregateFields: metricQuery.queryParams.aggregateFields.map(field => {
      if (isVisualize(field)) {
        return field.serialize();
      }

      // Keep Group By as-is
      return field;
    }),
    aggregateSortBys: metricQuery.queryParams.aggregateSortBys,
    mode: metricQuery.queryParams.mode,
  });
}

export function defaultMetricQuery(): BaseMetricQuery {
  return {
    metric: {name: '', type: ''},
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: defaultQuery(),

      cursor: '',
      fields: defaultFields(),
      sortBys: defaultSortBys(defaultFields()),

      aggregateCursor: '',
      aggregateFields: defaultAggregateFields(),
      aggregateSortBys: defaultAggregateSortBys(defaultAggregateFields()),
    }),
  };
}

export function defaultQuery(): string {
  return '';
}

export function defaultFields(): string[] {
  return ['id', 'timestamp'];
}

export function defaultSortBys(fields: string[]): Sort[] {
  if (fields.includes('timestamp')) {
    return [
      {
        field: 'timestamp',
        kind: 'desc' as const,
      },
    ];
  }

  if (fields.length) {
    return [
      {
        field: fields[0]!,
        kind: 'desc' as const,
      },
    ];
  }

  return [];
}

export function defaultAggregateFields(): AggregateField[] {
  return [new VisualizeFunction('per_second(value)')];
}

export function defaultAggregateSortBys(_: AggregateField[]): Sort[] {
  // TODO: Handle aggregate fields for compound sort-by.
  return [{field: 'per_second(value)', kind: 'desc'}];
}

export function stripMetricParamsFromLocation(location: Location): Location {
  const target: Location = {...location, query: {...location.query}};
  for (const key in ReadableQueryParams.prototype) {
    delete target.query[key];
  }
  // Metric context
  delete target.query.metric;

  return target;
}
