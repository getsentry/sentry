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
import {ChartType} from 'sentry/views/insights/common/components/chart';

export interface TraceMetric {
  name: string;
  type: string;
}

export interface BaseMetricQuery {
  metric: TraceMetric;
  queryParams: ReadableQueryParams;
}

export interface MetricQuery extends BaseMetricQuery {
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
  if (typeof metric !== 'object') {
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

  return {
    metric,
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query,

      cursor: '',
      fields: defaultFields(),
      sortBys: defaultSortBys(),

      aggregateCursor: '',
      aggregateFields,
      aggregateSortBys: defaultAggregateSortBys(),
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
      sortBys: defaultSortBys(),

      aggregateCursor: '',
      aggregateFields: defaultAggregateFields(),
      aggregateSortBys: defaultAggregateSortBys(),
    }),
  };
}

export function defaultQuery(): string {
  return '';
}

function defaultFields(): string[] {
  return ['id', 'timestamp'];
}

function defaultSortBys(): Sort[] {
  return [{field: 'timestamp', kind: 'desc'}];
}

function defaultAggregateFields(): AggregateField[] {
  return [new VisualizeFunction('sum(value)', {chartType: ChartType.BAR})];
}

function defaultAggregateSortBys(): Sort[] {
  return [{field: 'sum(value)', kind: 'desc'}];
}
