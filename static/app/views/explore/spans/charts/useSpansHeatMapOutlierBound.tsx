import {useQuery} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {defined} from 'sentry/utils/defined';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';

import type {SpansHeatMapYAxis} from './spansHeatMap';

const SAMPLE_WINDOW_MS = 60 * 60 * 1000;

// Below this many spans in the sample window, p99.9 is less than one span and
// the extrapolation isn't backed by enough data to be worth trusting.
const MIN_SAMPLE_COUNT = 1000;

// Only clip when it at least doubles the resolution of the remaining rows,
// otherwise hiding spans isn't worth it.
const MIN_CLIP_GAIN = 2;

// Standard normal quantiles for p95, p99 and p99.9.
const Z_P95 = 1.6449;
const Z_P99 = 2.3263;
const Z_P999 = 3.0902;

type OutlierBoundResponse = {
  data: Array<Record<string, number | null>>;
};

interface HeatMapYBounds {
  yMax: number;
  yMin: number;
}

interface UseSpansHeatMapOutlierBoundOptions {
  enabled: boolean;
  query: string;
  yAxis: SpansHeatMapYAxis | undefined;
}

/**
 * Picks default heat map Y-axis bounds so a handful of extreme spans don't
 * squash the rest of the distribution into the bottom few rows.
 *
 * Fetches p0, p95, p99 and max over the most recent hour of the selected window
 * at the highest accuracy tier, then extrapolates p99.9 from a log-normal fit
 * through p95 and p99. Fitting only the tail matters: an unfiltered query mixes
 * very different span types, so a fit through p50 badly overshoots.
 *
 * Skipped when the sample is too small to extrapolate from, or when the slowest
 * span isn't far enough past p99.9 for clipping to buy much resolution.
 */
export function useSpansHeatMapOutlierBound({
  enabled,
  query,
  yAxis,
}: UseSpansHeatMapOutlierBoundOptions): {
  isPending: boolean;
  bounds?: HeatMapYBounds;
} {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();

  const isActive = enabled && defined(yAxis) && isReady;

  const fields = {
    p0: `min(${yAxis})`,
    p95: `p95(${yAxis})`,
    p99: `p99(${yAxis})`,
    max: `max(${yAxis})`,
    count: 'count()',
  };

  const {data, isPending} = useQuery({
    ...apiOptions.as<OutlierBoundResponse>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          dataset: DiscoverDatasets.SPANS,
          field: Object.values(fields),
          query,
          per_page: 1,
          project: selection.projects,
          environment: selection.environments,
          sampling: SAMPLING_MODE.HIGH_ACCURACY,
          referrer: 'api.explore.spans-heatmap-outlier-bound',
          ...normalizeDateTimeParams(sampleWindow(selection.datetime)),
        },
        staleTime: Infinity,
      }
    ),
    enabled: isActive,
  });

  if (!isActive) {
    return {isPending: false};
  }

  const row = data?.data[0];
  return {
    isPending,
    bounds: row
      ? estimateBounds({
          p0: row[fields.p0] ?? null,
          p95: row[fields.p95] ?? null,
          p99: row[fields.p99] ?? null,
          max: row[fields.max] ?? null,
          count: row[fields.count] ?? null,
        })
      : undefined,
  };
}

function sampleWindow(datetime: PageFilters['datetime']): PageFilters['datetime'] {
  if (defined(datetime.start) && defined(datetime.end)) {
    const end = new Date(datetime.end);
    return {
      start: new Date(end.getTime() - SAMPLE_WINDOW_MS),
      end,
      period: null,
      utc: datetime.utc,
    };
  }
  return {start: null, end: null, period: '1h', utc: datetime.utc};
}

/**
 * With a log-normal fit through p95 and p99, σ = ln(p99 / p95) / (z99 − z95),
 * so p99.9 = p99 · (p99 / p95)^((z99.9 − z99) / (z99 − z95)).
 */
function estimateBounds({
  p0,
  p95,
  p99,
  max,
  count,
}: Record<'p0' | 'p95' | 'p99' | 'max' | 'count', number | null>):
  | HeatMapYBounds
  | undefined {
  if (
    !defined(p0) ||
    !p95 ||
    !p99 ||
    !max ||
    !count ||
    count < MIN_SAMPLE_COUNT ||
    p99 <= p95
  ) {
    return undefined;
  }

  const p999 = p99 * Math.pow(p99 / p95, (Z_P999 - Z_P99) / (Z_P99 - Z_P95));
  if (max - p0 < MIN_CLIP_GAIN * (p999 - p0)) {
    return undefined;
  }

  return {yMin: p0, yMax: p999};
}
