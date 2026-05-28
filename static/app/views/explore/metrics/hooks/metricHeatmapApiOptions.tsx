import {skipToken} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';

interface MetricHeatmapApiOptions {
  enabled: boolean;
  interval: string;
  organization: Organization;
  query: string;
  selection: PageFilters;
  traceMetric: TraceMetric;
  yBuckets: number;
}

export function metricHeatmapApiOptions({
  traceMetric,
  enabled,
  organization,
  selection,
  query,
  interval,
  yBuckets,
}: MetricHeatmapApiOptions) {
  const traceMetricFilter = createTraceMetricEventsFilter([traceMetric]);
  const combinedQuery = query ? `${traceMetricFilter} (${query})` : traceMetricFilter;

  const intervalInMilliseconds = intervalToMilliseconds(interval);
  const {start, end, statsPeriod} = normalizeDateTimeParams(selection.datetime);
  const usesRelativeDateRange = !defined(start) && !defined(end) && defined(statsPeriod);

  return apiOptions.as<HeatMapSeries>()(
    '/organizations/$organizationIdOrSlug/events-heatmap/',
    {
      path: enabled ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset: DiscoverDatasets.TRACEMETRICS,
        xAxis: 'time',
        yAxis: 'value',
        zAxis: 'count()',
        yBuckets,
        interval,
        query: combinedQuery,
        project: selection.projects,
        environment: selection.environments,
        start,
        end,
        statsPeriod,
        referrer: 'api.explore.tracemetrics-heatmap',
      },
      staleTime:
        usesRelativeDateRange && intervalInMilliseconds !== 0
          ? intervalInMilliseconds
          : Infinity,
    }
  );
}
