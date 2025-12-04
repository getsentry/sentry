import type {Location} from 'history';

import {defined} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {validateAggregateSort} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isBaseVisualize,
  isVisualize,
  Visualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

export interface TraceMetric {
  name: string;
  type: string;
}

function isTraceMetric(value: unknown): value is TraceMetric {
  if (value === null || !defined(value) || typeof value !== 'object') {
    return false;
  }

  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'type' in value &&
    typeof value.type === 'string'
  );
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

  if (!isTraceMetric(json.metric)) {
    return null;
  }

  const metric = json.metric;
  const query = parseQuery(json.query);
  const visualizes = parseVisualizes(json.aggregateFields);

  if (!visualizes.length) {
    return null;
  }

  const groupBys = parseGroupBys(json.aggregateFields);
  const aggregateFields = [...visualizes, ...groupBys];
  const aggregateSortBys = parseAggregateSortBys(json.aggregateSortBys, aggregateFields);

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

function defaultVisualize(): Visualize {
  return new VisualizeFunction('per_second(value)');
}

function defaultGroupBys(): GroupBy[] {
  return [];
}

export function defaultAggregateFields(): AggregateField[] {
  return [defaultVisualize(), ...defaultGroupBys()];
}

export function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
  const visualize = aggregateFields.find(isVisualize);
  if (!defined(visualize)) {
    return [];
  }
  return [{field: visualize.yAxis, kind: 'desc'}];
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

function parseQuery(value: unknown): string {
  return typeof value === 'string' ? value : defaultQuery();
}

function parseVisualizes(value: unknown): Visualize[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const baseVisualize = value.find(isBaseVisualize);
  return baseVisualize ? Visualize.fromJSON(baseVisualize) : [];
}

function parseGroupBys(value: unknown): GroupBy[] {
  if (!Array.isArray(value)) {
    return defaultGroupBys();
  }

  return value.filter<GroupBy>(isGroupBy);
}

function parseAggregateSortBys(
  value: unknown,
  aggregateFields: AggregateField[]
): Sort[] {
  if (!Array.isArray(value) || value.length === 0) {
    return defaultAggregateSortBys(aggregateFields);
  }

  if (value.length > 0) {
    if (value.some(v => !validateAggregateSort(v, aggregateFields))) {
      return defaultAggregateSortBys(aggregateFields);
    }
  }

  return value;
}
