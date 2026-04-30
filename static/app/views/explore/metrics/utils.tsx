import qs from 'query-string';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import type {EventsMetaType, MetaType} from 'sentry/utils/discover/eventView';
import {
  DurationUnit,
  RateUnit,
  SizeUnit,
  stripEquationPrefix,
  type ColumnType,
  type Sort,
} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import type {
  RawVisualize,
  SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {isRawVisualize} from 'sentry/views/explore/hooks/useGetSavedQueries';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  defaultMetricQuery,
  encodeMetricQueryParams,
  type BaseMetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';
import {NONE_UNIT} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {normalizeFunctionToken} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  TraceMetricKnownFieldKey,
  type SampleTableColumnKey,
} from 'sentry/views/explore/metrics/types';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';

export function makeMetricsPathname({
  organizationSlug,
  path,
}: {
  organizationSlug: string;
  path: string;
}) {
  return normalizeUrl(`/organizations/${organizationSlug}/explore/metrics${path}`);
}

export function createTraceMetricEventsFilter(traceMetrics: TraceMetric[]): string {
  const search = new MutableSearch('');
  traceMetrics.forEach((traceMetric, index) => {
    // Open the parentheses around this tracemetric filter
    search.addOp('(');

    search.addFilterValue('metric.name', traceMetric.name);
    search.addFilterValue('metric.type', traceMetric.type);
    const addNoneOperators = traceMetric.unit === NONE_UNIT;
    if (addNoneOperators) {
      search.addOp('(');
      search.addFilterValue('!has', 'metric.unit');
      search.addOp('OR');
    }

    search.addFilterValue('metric.unit', traceMetric.unit ?? NONE_UNIT);

    if (addNoneOperators) {
      search.addOp(')');
    }

    // Close the parentheses around this tracemetric filter
    search.addOp(')');

    // Add the OR operator between this tracemetric filter and the next one
    if (index < traceMetrics.length - 1) {
      search.addOp('OR');
    }
  });

  return search.toString();
}

/**
 * Creates a filter string for co-occurring attributes based on a metric name.
 * This filter is used to narrow down attribute keys to only those that co-occur
 * with the specified metric.
 */
export function createTraceMetricFilter(traceMetric: TraceMetric): string | undefined {
  return traceMetric.name
    ? MutableSearch.fromQueryObject({
        [`sentry._internal.cooccuring.name.${traceMetric.name}`]: ['true'],
        [`sentry._internal.cooccuring.type.${traceMetric.type}`]: ['true'],
      }).formatString()
    : undefined;
}

export function getMetricsUnit(
  meta: MetaType | EventsMetaType,
  field: string
): string | undefined {
  const unitFromField = meta?.units?.[field];

  if (field.startsWith('per_second(')) {
    return RateUnit.PER_SECOND;
  }
  if (field.startsWith('per_minute(')) {
    return RateUnit.PER_MINUTE;
  }
  return unitFromField;
}

type BaseGetMetricsUrlParams = {
  id?: number;
  interval?: string;
  metricQueries?: BaseMetricQuery[];
  referrer?: string;
  selection?: PageFilters;
  title?: string;
};

export function getMetricsUrl(
  params: BaseGetMetricsUrlParams & {organization: Organization}
): string;
export function getMetricsUrl(
  params: BaseGetMetricsUrlParams & {organization: string}
): string;
export function getMetricsUrl({
  organization,
  selection,
  metricQueries,
  id,
  interval,
  referrer,
  title,
}: BaseGetMetricsUrlParams & {organization: Organization | string}) {
  const {start, end, period: statsPeriod, utc} = selection?.datetime ?? {};
  const {environments, projects} = selection ?? {};

  const queryParams = {
    // Pass empty string when projects is empty to preserve "My Projects" selection in URL
    project: projects?.length === 0 ? '' : projects,
    environment: environments,
    statsPeriod,
    start,
    end,
    utc,
    metric: metricQueries?.map(metricQuery => encodeMetricQueryParams(metricQuery)),
    id,
    interval,
    referrer,
    title,
  };

  const orgSlug = typeof organization === 'string' ? organization : organization.slug;
  return (
    makeMetricsPathname({organizationSlug: orgSlug, path: '/'}) +
    `?${qs.stringify(queryParams, {skipNull: true})}`
  );
}

export function getMetricsUrlFromSavedQueryUrl({
  savedQuery,
  organization,
}: {
  organization: Organization;
  savedQuery: SavedQuery;
}): string {
  const metricQueries: BaseMetricQuery[] = savedQuery.query.map(queryItem => {
    const defaultQuery = defaultMetricQuery();

    const visualizes =
      queryItem.aggregateField
        ?.filter<RawVisualize>(isRawVisualize)
        .flatMap(vis => Visualize.fromJSON(vis)) || [];

    const groupBys = queryItem.aggregateField?.filter<GroupBy>(isGroupBy) || [];

    const aggregateFields = [...visualizes, ...groupBys];

    const hasAggregateOrderby = defined(queryItem.aggregateOrderby);
    let aggregateSortBys: Sort[] | undefined;
    if (hasAggregateOrderby) {
      aggregateSortBys = queryItem.aggregateOrderby
        ? decodeSorts(queryItem.aggregateOrderby)
        : undefined;
    } else if (queryItem.orderby) {
      aggregateSortBys = decodeSorts(queryItem.orderby);
    }

    const sortBys =
      hasAggregateOrderby && queryItem.orderby
        ? decodeSorts(queryItem.orderby)
        : undefined;

    return {
      ...defaultQuery,
      metric: queryItem.metric ?? defaultQuery.metric,
      queryParams: defaultQuery.queryParams.replace({
        mode: queryItem.mode,
        query: queryItem.query,
        aggregateFields,
        aggregateSortBys,
        sortBys,
      }),
    };
  });

  return getMetricsUrl({
    organization,
    metricQueries,
    title: savedQuery.name,
    id: savedQuery.id,
    interval: savedQuery.interval,
    selection: {
      datetime: {
        end: savedQuery.end ?? null,
        period: savedQuery.range ?? null,
        start: savedQuery.start ?? null,
        utc: null,
      },
      environments: savedQuery.environment ? [...savedQuery.environment] : [],
      projects: savedQuery.projects ? [...savedQuery.projects] : [],
    },
  });
}

export function getMetricTableColumnType(
  column: SampleTableColumnKey
): 'value' | 'metric_value' {
  if (column === TraceMetricKnownFieldKey.METRIC_VALUE) {
    return 'metric_value'; // Special cased for headers and rendering usually.
  }
  return 'value';
}

export function makeMetricsAggregate({
  aggregate,
  traceMetric,
  attribute,
}: {
  aggregate: string;
  traceMetric: TraceMetric;
  attribute?: string;
}) {
  const args = [
    attribute ?? 'value', // hard coded to `value` for now, but can be other attributes
    traceMetric.name,
    traceMetric.type,
    traceMetric.unit ?? '-',
  ];
  return `${aggregate}(${args.join(',')})`;
}

export function updateVisualizeYAxis(
  visualize: VisualizeFunction,
  aggregate: string,
  traceMetric: TraceMetric
): VisualizeFunction {
  return visualize.replace({
    yAxis: makeMetricsAggregate({
      aggregate,
      traceMetric,
    }),
    chartType: undefined,
  });
}

export function isEmptyTraceMetric(traceMetric: TraceMetric): boolean {
  return traceMetric.name === '';
}

export function isCompleteTraceMetric(traceMetric: TraceMetric): boolean {
  return Boolean(traceMetric.name && traceMetric.type);
}

const DURATION_UNIT_VALUES = new Set<string>(Object.values(DurationUnit));
const SIZE_UNIT_VALUES = new Set<string>(Object.values(SizeUnit));
const PERCENTAGE_UNIT_VALUES = new Set<string>(['ratio', 'percent']);

/**
 * Maps a metric unit (from TraceMetric.unit) to the ColumnType and
 * unit string that the discover FieldRenderer system expects.
 *
 * The backend can't infer units for the raw `value` field in events
 * responses, so the frontend must do this mapping based on the selected
 * metric's unit.
 */
export function mapMetricUnitToFieldType(metricUnit: string | undefined): {
  fieldType: ColumnType;
  unit: string | undefined;
} {
  if (!metricUnit || metricUnit === '-') {
    return {fieldType: 'number', unit: undefined};
  }
  if (DURATION_UNIT_VALUES.has(metricUnit)) {
    return {fieldType: 'duration', unit: metricUnit};
  }
  if (SIZE_UNIT_VALUES.has(metricUnit)) {
    return {fieldType: 'size', unit: metricUnit};
  }
  if (PERCENTAGE_UNIT_VALUES.has(metricUnit)) {
    return {fieldType: 'percentage', unit: metricUnit};
  }
  return {fieldType: 'number', unit: undefined};
}

/**
 * Takes an equation and returns a filter that looks for all metric events
 * that are used in the equation.
 */
export function getEquationMetricsTotalFilter(equation: string) {
  const expression = new Expression(stripEquationPrefix(equation));
  const aggregatesUsed = expression.tokens
    .filter(isTokenFunction)
    .map(token => normalizeFunctionToken(token).plainAggregate);

  const traceMetricsUsed = aggregatesUsed.map(aggregate => {
    const {traceMetric} = parseMetricAggregate(aggregate);
    return traceMetric;
  });

  return createTraceMetricEventsFilter(traceMetricsUsed);
}
