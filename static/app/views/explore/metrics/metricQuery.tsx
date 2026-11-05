import type {Location} from 'history';
import {parseAsJson} from 'nuqs';
import {z} from 'zod';

import {defined} from 'sentry/utils/defined';
import {EQUATION_PREFIX, type Sort} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {validateAggregateSort} from 'sentry/views/explore/queryParams/aggregateSortBy';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {
  ReadableQueryParams,
  type ReadableQueryParamsOptions,
} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualize,
  parseVisualize,
  Visualize,
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

import {SORTABLE_SAMPLE_COLUMNS} from './types';

export type TraceMetric = {
  name: string;
  type: string;
  unit?: string | null;
};

export const traceMetricSchema = z.looseObject({
  name: z.string(),
  type: z.string(),
  unit: z.string().nullish(),
});

export interface BaseMetricQuery {
  metric: TraceMetric;
  queryParams: ReadableQueryParams;
  label?: string;
}

export interface MetricQuery extends BaseMetricQuery {
  removeMetric: () => void;
  setQueryParams: (queryParams: ReadableQueryParams) => void;
  setTraceMetric: (traceMetric: TraceMetric) => void;
}

const sortSchema = z.looseObject({field: z.string(), kind: z.enum(['asc', 'desc'])});

const parseAsMetricQuery = parseAsJson(
  z.object({
    metric: traceMetricSchema,
    query: z.string().catch(''),
    aggregateFields: z.array(z.unknown()).catch([]),
    aggregateSortBys: z.array(sortSchema).readonly().catch([]),
    sortBys: z
      .array(sortSchema.refine(sort => SORTABLE_SAMPLE_COLUMNS.has(sort.field)))
      .catch([]),
    mode: z.enum(Mode).catch(Mode.SAMPLES),
  })
);

export function decodeMetricsQueryParams(value: string): BaseMetricQuery | null {
  const json = parseAsMetricQuery.parse(value);
  if (!json) {
    // Surfaces encoding regressions that would otherwise silently drop a metric.
    // eslint-disable-next-line no-console
    console.warn('[decodeMetricsQueryParams] Failed to parse metric URL param:', value);
    return null;
  }

  const visualizes = json.aggregateFields.flatMap(item => parseVisualize(item));

  if (!visualizes.length) {
    return null;
  }

  const aggregateFields = [...visualizes, ...json.aggregateFields.filter(isGroupBy)];
  const fields = defaultFields();

  return {
    metric: json.metric,
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: json.mode,
      query: json.query,

      cursor: '',
      fields,
      sortBys: json.sortBys.length ? json.sortBys : defaultSortBys(fields),

      aggregateCursor: '',
      aggregateFields,
      aggregateSortBys:
        json.aggregateSortBys.length &&
        json.aggregateSortBys.every(sort => validateAggregateSort(sort, aggregateFields))
          ? json.aggregateSortBys
          : defaultAggregateSortBys(aggregateFields),
    }),
  };
}

export function encodeMetricQueryParams(metricQuery: BaseMetricQuery): string {
  return parseAsMetricQuery.serialize({
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
    sortBys: metricQuery.queryParams.sortBys,
    mode: metricQuery.queryParams.mode,
  });
}

export function defaultMetricQuery({
  type = 'aggregate',
}: {type?: 'aggregate' | 'equation'} = {}): BaseMetricQuery {
  const newFields =
    type === 'equation' ? [defaultAggregateEquation()] : defaultAggregateFields();
  return {
    metric: {name: '', type: ''},
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: type === 'equation' ? Mode.AGGREGATE : Mode.SAMPLES,
      query: '',

      cursor: '',
      fields: defaultFields(),
      sortBys: defaultSortBys(defaultFields()),

      aggregateCursor: '',
      aggregateFields: newFields,
      aggregateSortBys: defaultAggregateSortBys(newFields),
    }),
  };
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
  return new VisualizeFunction('sum(value)');
}

function defaultGroupBys(): GroupBy[] {
  return [];
}

export function defaultAggregateFields(): AggregateField[] {
  return [defaultVisualize(), ...defaultGroupBys()];
}

function defaultAggregateEquation() {
  return new VisualizeEquation(EQUATION_PREFIX);
}

export function defaultAggregateSortBys(aggregateFields: AggregateField[]): Sort[] {
  const visualize = aggregateFields.find(isVisualize);
  if (!defined(visualize)) {
    return [];
  }
  return [{field: visualize.yAxis, kind: 'desc'}];
}

const READABLE_QUERY_PARAMS_KEYS = Object.keys({
  aggregateCursor: true,
  aggregateFields: true,
  aggregateSortBys: true,
  breakdownCursor: true,
  breakdownQuery: true,
  crossEvents: true,
  cursor: true,
  extrapolate: true,
  fields: true,
  id: true,
  mode: true,
  query: true,
  sortBys: true,
  title: true,
} satisfies Record<keyof ReadableQueryParamsOptions, true>);

export function stripMetricParamsFromLocation(location: Location): Location {
  const target: Location = {...location, query: {...location.query}};
  for (const key of READABLE_QUERY_PARAMS_KEYS) {
    delete target.query[key];
  }
  delete target.query.metric;

  return target;
}
