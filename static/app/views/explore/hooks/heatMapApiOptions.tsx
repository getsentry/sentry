import {skipToken} from '@tanstack/react-query';

import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {HeatMapWindow} from 'sentry/views/explore/metrics/hooks/partitionHeatMapWindows';

import type {SamplingMode} from './useProgressiveQuery';

interface HeatMapApiOptions {
  dataset: DiscoverDatasets;
  organization: Organization;
  query: string;
  referrer: string;
  selection: PageFilters;
  timeWindow: HeatMapWindow;
  yAxis: string;
  interval?: string | null;
  sampling?: SamplingMode;
  yBuckets?: number | null;
  yMax?: number;
  yMin?: number;
}

export function heatMapApiOptions({
  dataset,
  organization,
  selection,
  timeWindow,
  yAxis,
  query,
  referrer,
  interval,
  sampling,
  yBuckets,
  yMin,
  yMax,
}: HeatMapApiOptions) {
  const intervalInMilliseconds = defined(interval) ? intervalToMilliseconds(interval) : 0;
  const valid =
    defined(interval) && intervalInMilliseconds > 0 && defined(yBuckets) && yBuckets > 0;

  // Absolute windows are immutable → cache forever. Relative windows slide with
  // `now`, so refetch once per interval to pull the newest bucket.
  const isAbsolute = 'start' in timeWindow;
  const staleTime = isAbsolute ? Infinity : intervalInMilliseconds;

  return apiOptions.as<HeatMapSeries>()(
    '/organizations/$organizationIdOrSlug/events-heatmap/',
    {
      path: valid ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        dataset,
        xAxis: 'time',
        yAxis,
        zAxis: 'count()',
        yBuckets,
        interval,
        yMin,
        yMax,
        sampling,
        query,
        project: selection.projects,
        environment: selection.environments,
        ...timeWindow,
        referrer,
      },
      staleTime,
    }
  );
}
