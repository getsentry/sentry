import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

const DAY_MINUTES = 24 * 60;

/**
 * The only intervals (in minutes) Seer accepts, with how many days it scores
 * in one request at each. Seer rejects any other `time_period`, and drops
 * anything older than the day limit. Mirrors `TimePeriods` and
 * `max_batch_days_for_combo_detection` in Seer.
 */
export const SEER_INTERVALS: ReadonlyArray<{days: number; minutes: number}> = [
  {minutes: 5, days: 7},
  {minutes: 15, days: 15},
  {minutes: 30, days: 21},
  {minutes: 60, days: 28},
];

export function getIntervalMinutes(interval: string): number {
  return intervalToMilliseconds(interval) / 60_000;
}

function formatIntervalMinutes(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : `${minutes}m`;
}

export interface AnomalyScoringPlan {
  /**
   * Days of history Seer uses at this interval, which is also the most of the
   * chart it can score in one request
   */
  historyDays: number;
  /**
   * The interval sent to Seer, e.g. `1h`
   */
  interval: string;
  intervalMinutes: number;
  /**
   * Whether only the end of the chart is scored, because the range is longer
   * than Seer scores in one request
   */
  isPartial: boolean;
  /**
   * Whether the scoring interval differs from the chart's
   */
  isResampled: boolean;
  /**
   * How much of the end of the chart is scored, in minutes
   */
  scoredMinutes: number;
}

/**
 * Picks the interval to score a chart at. It's the largest interval Seer
 * accepts that isn't coarser than the chart's (5m for 1m charts), stepping up
 * when the range is longer than Seer scores at that interval. Charts longer
 * than Seer's 1h limit only have their last 28 days scored.
 */
export function getAnomalyScoringPlan(
  datetime: DateTimeObject,
  chartInterval: string
): AnomalyScoringPlan {
  const chartMinutes = getDiffInMinutes(datetime);
  const chartIntervalMinutes = getIntervalMinutes(chartInterval);

  let index = SEER_INTERVALS.findLastIndex(
    candidate => candidate.minutes <= chartIntervalMinutes
  );
  index = Math.max(index, 0);
  while (
    index < SEER_INTERVALS.length - 1 &&
    SEER_INTERVALS[index]!.days * DAY_MINUTES < chartMinutes
  ) {
    index += 1;
  }

  const {minutes, days} = SEER_INTERVALS[index]!;
  const maxScoredMinutes = days * DAY_MINUTES;
  return {
    interval: formatIntervalMinutes(minutes),
    intervalMinutes: minutes,
    historyDays: days,
    scoredMinutes: Math.min(chartMinutes, maxScoredMinutes),
    isPartial: chartMinutes > maxScoredMinutes,
    isResampled: minutes !== chartIntervalMinutes,
  };
}

/**
 * Explains how the chart is scored when it's not exactly what the chart
 * shows, or `null` when it is.
 */
export function getAnomalyScoringWarning(
  plan: AnomalyScoringPlan,
  chartInterval: string
): string | null {
  const resampled = plan.isResampled
    ? t(
        'Detected at %s, so markers may not line up with %s buckets',
        plan.interval,
        chartInterval
      )
    : null;
  const partial = plan.isPartial
    ? t('Only the last %s days are checked', plan.historyDays)
    : null;

  if (resampled && partial) {
    return `${resampled}. ${partial}`;
  }
  return resampled ?? partial;
}
