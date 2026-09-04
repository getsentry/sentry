import type {StatsPeriodRange} from 'sentry/components/pageFilters/types';
import type {PageFilterDatetime} from 'sentry/types/core';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

export const TRACE_METRICS_INGESTION_DELAY_SECONDS = 120;

export function ingestionDelayedRelativePeriod(
  datetime: PageFilterDatetime,
  ingestionDelaySeconds: number
): StatsPeriodRange | undefined {
  const {end, period} = datetime;

  if (
    !period ||
    end ||
    ingestionDelaySeconds <= 0 ||
    intervalToMilliseconds(period) <= ingestionDelaySeconds * 1000
  ) {
    return undefined;
  }

  return {statsPeriodStart: period, statsPeriodEnd: `${ingestionDelaySeconds}s`};
}
