import type {Sort} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export interface TraceMetric {
  name: string;
}

export interface BaseMetricQuery {
  metric: TraceMetric;
  queryParams: ReadableQueryParams;
}

export interface MetricQuery extends BaseMetricQuery {
  setMetricName: (metricName: string) => void;
  setQueryParams: (queryParams: ReadableQueryParams) => void;
}

export function decodeMetricsQueryParams(value: string): BaseMetricQuery | null {
  let json: any;
  try {
    json = JSON.parse(value);
  } catch {
    return null;
  }

  const metric = json.metric;
  if (typeof metric !== 'string') {
    return null;
  }

  const query = json.query;
  if (typeof query !== 'string') {
    return null;
  }

  return {
    metric: {name: metric},
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query,

      cursor: '',
      fields: defaultFields(),
      sortBys: defaultSortBys(),

      aggregateCursor: '',
      aggregateFields: defaultAggregateFields(),
      aggregateSortBys: defaultAggregateSortBys(),
    }),
  };
}

export function encodeMetricQueryParams(metricQuery: BaseMetricQuery): string {
  return JSON.stringify({
    metric: metricQuery.metric.name,
    query: metricQuery.queryParams.query,
  });
}

export function defaultMetricQuery(): BaseMetricQuery {
  return {
    metric: {name: ''},
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
