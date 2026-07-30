import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useMetricsFrozenTracePeriod} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

const MILLISECONDS_PER_SECOND = 1000;

export type MetricsRelativePeriod = {
  statsPeriodEnd: string;
  statsPeriodStart: string;
};

export function getMetricsRelativePeriod(
  datetime: PageFilters['datetime'],
  ingestionDelaySeconds = INGESTION_DELAY
): MetricsRelativePeriod | undefined {
  const {end, period} = datetime;
  const periodMs = period ? intervalToMilliseconds(period) : 0;

  if (period && periodMs > ingestionDelaySeconds * MILLISECONDS_PER_SECOND && !end) {
    return {
      statsPeriodStart: period,
      statsPeriodEnd: `${ingestionDelaySeconds}s`,
    };
  }

  return undefined;
}

export function useMetricsRelativePeriod(
  ingestionDelaySeconds = INGESTION_DELAY
): MetricsRelativePeriod | undefined {
  const {selection} = usePageFilters();
  const frozenTracePeriod = useMetricsFrozenTracePeriod();

  const datetime = useMemo(
    () =>
      frozenTracePeriod
        ? {
            start: frozenTracePeriod.start ?? null,
            end: frozenTracePeriod.end ?? null,
            period: frozenTracePeriod.period ?? null,
            utc: selection.datetime.utc,
          }
        : selection.datetime,
    [selection.datetime, frozenTracePeriod]
  );

  return useMemo(
    () => getMetricsRelativePeriod(datetime, ingestionDelaySeconds),
    [datetime, ingestionDelaySeconds]
  );
}
