import {
  toAggregateFields,
  toMode,
  toPageFilters,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbedParams';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import type {NewQuery, Organization} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  AlwaysPresentTraceMetricFields,
  TraceSamplesTableColumns,
} from 'sentry/views/explore/metrics/constants';
import {getTraceSamplesTableFields} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  createTraceMetricEventsFilter,
  getDefaultMetricYAxis,
  getMetricYAxis,
  makeMetricsPathname,
} from 'sentry/views/explore/metrics/utils';

export type MetricsQueryData = EmbedOutput<'metricsQuery'>;

/** The metric this embed describes, in the shape the Metrics helpers expect. */
function toTraceMetric({name, type, unit}: MetricsQueryData): TraceMetric {
  return unit ? {name, type, unit} : {name, type};
}

/**
 * Explore identifies a metric inside the aggregate's own arguments rather than
 * as a separate parameter, so a bare `p95(value)` from Seer means nothing on
 * its own. Qualify whatever arrived, and fall back to the aggregate the
 * Metrics UI would have opened with for this metric's type.
 */
export function resolveMetricYAxes(data: MetricsQueryData): string[] {
  const traceMetric = toTraceMetric(data);

  return data.yAxes?.length
    ? data.yAxes.map(yAxis => getMetricYAxis(yAxis, traceMetric))
    : [getDefaultMetricYAxis(traceMetric)];
}

/**
 * Samples have no aggregate to carry the metric's identity, so it moves into
 * the search string instead — the same filter the Metrics samples table adds.
 */
function buildMetricsQuery(data: MetricsQueryData): string {
  if (data.mode === 'aggregate') {
    return data.query;
  }

  const identity = createTraceMetricEventsFilter([toTraceMetric(data)]);
  return data.query ? `${data.query} ${identity}` : identity;
}

export function getMetricsQueryFields(data: MetricsQueryData): string[] {
  if (data.mode === 'aggregate') {
    return Array.from(
      new Set([...(data.groupBy ?? []).filter(Boolean), ...resolveMetricYAxes(data)])
    );
  }

  return data.fields?.length
    ? data.fields
    : Array.from(
        new Set([
          ...getTraceSamplesTableFields(TraceSamplesTableColumns),
          ...AlwaysPresentTraceMetricFields,
        ])
      );
}

export function buildMetricsEventView(data: MetricsQueryData): EventView {
  const fields = getMetricsQueryFields(data);
  const query: NewQuery = {
    id: undefined,
    name: data.title ?? data.name,
    fields,
    orderby: [data.sort ?? (data.mode === 'aggregate' ? `-${fields[0]}` : '-timestamp')],
    query: buildMetricsQuery(data),
    version: 2,
    dataset: DiscoverDatasets.TRACEMETRICS,
  };

  return EventView.fromNewQueryWithPageFilters(query, toPageFilters(data));
}

/**
 * Metrics keeps each panel's whole query in one repeated `metric` param, as a
 * JSON blob. Explore refuses to decode one that charts nothing, so the
 * aggregate fields always carry a resolved y-axis.
 */
export function getMetricsQueryHref(
  data: MetricsQueryData,
  organization: Organization
): string {
  const {name, type, unit, query, mode, sort, groupBy} = data;
  const {projects, environments, datetime} = toPageFilters(data);

  const metric = JSON.stringify({
    metric: {name, type, unit},
    query,
    aggregateFields: toAggregateFields({
      groupBy,
      yAxes: resolveMetricYAxes(data),
    }),
    aggregateSortBys: sort ? [sort] : undefined,
    mode: toMode(mode),
  });

  const params = new URLSearchParams();
  for (const project of projects) {
    params.append('project', String(project));
  }
  for (const environment of environments) {
    params.append('environment', environment);
  }
  if (datetime.period) {
    params.set('statsPeriod', datetime.period);
  }
  if (datetime.start) {
    params.set('start', String(datetime.start));
  }
  if (datetime.end) {
    params.set('end', String(datetime.end));
  }
  params.append('metric', metric);

  return `${makeMetricsPathname({organizationSlug: organization.slug, path: '/'})}?${params}`;
}
