import type {ReactNode} from 'react';
import qs from 'query-string';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
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
import type {
  BaseMetricQuery,
  TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {
  defaultMetricQuery,
  encodeMetricQueryParams,
} from 'sentry/views/explore/metrics/metricQuery';
import {isGroupBy, type GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';
import type {PickableDays} from 'sentry/views/explore/utils';

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

export function metricsPickableDays(): PickableDays {
  const relativeOptions: Array<[string, ReactNode]> = [
    ['1h', t('Last hour')],
    ['24h', t('Last 24 hours')],
    ['7d', t('Last 7 days')],
    ['14d', t('Last 14 days')],
    ['30d', t('Last 30 days')],
  ];

  return {
    defaultPeriod: '24h',
    maxPickableDays: 30, // May change with downsampled multi month support.
    relativeOptions: ({
      arbitraryOptions,
    }: {
      arbitraryOptions: Record<string, ReactNode>;
    }) => ({
      ...arbitraryOptions,
      ...Object.fromEntries(relativeOptions),
    }),
  };
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
