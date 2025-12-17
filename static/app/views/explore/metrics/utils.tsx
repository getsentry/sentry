import qs from 'query-string';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {EventsMetaType, MetaType} from 'sentry/utils/discover/eventView';
import {RateUnit} from 'sentry/utils/discover/fields';
import {decodeSorts} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {
  RawVisualize,
  SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {isRawVisualize} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {TraceSamplesTableStatColumns} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  defaultMetricQuery,
  encodeMetricQueryParams,
  type BaseMetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';
import {
  TraceMetricKnownFieldKey,
  VirtualTableSampleColumnKey,
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

function getMetricsUrl(
  params: BaseGetMetricsUrlParams & {organization: Organization}
): string;
function getMetricsUrl(params: BaseGetMetricsUrlParams & {organization: string}): string;
function getMetricsUrl({
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
    project: projects,
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

    return {
      ...defaultQuery,
      metric: queryItem.metric ?? defaultQuery.metric,
      queryParams: defaultQuery.queryParams.replace({
        mode: queryItem.mode,
        query: queryItem.query,
        aggregateFields,
        aggregateSortBys: decodeSorts(queryItem.orderby) || [],
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
): 'value' | 'stat' | 'metric_value' {
  if (TraceSamplesTableStatColumns.includes(column as VirtualTableSampleColumnKey)) {
    return 'stat';
  }
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
    '-', // hard coded to `-` for now, but can be other units`
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
