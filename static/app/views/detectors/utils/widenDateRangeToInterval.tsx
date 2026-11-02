import moment from 'moment-timezone';

import {getUtcDateString} from 'sentry/utils/dates';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

const MINIMUM_CUSTOM_RANGE_INTERVALS = 3;

const MINUTE_MILLISECONDS = 60_000;

export interface DetectorDateRange {
  end: string | undefined;
  start: string | undefined;
  statsPeriod: string | undefined;
}

interface WidenDateRangeToIntervalOptions {
  dateRange: DetectorDateRange;
  intervalSeconds: number;
  nowMilliseconds: number;
}

interface WidenCustomRangeOptions {
  dateRange: DetectorDateRange;
  end: string;
  intervalSeconds: number;
  nowMilliseconds: number;
  start: string;
}

/**
 * Widen date range that are too short for the detector's interval to chart properly
 * If you give a relative period it becomes the last interval
 * Custom ranges that are too short get widened to a minimum width centered around
 * where the user made their selection
 */
export function widenDateRangeToInterval({
  dateRange,
  intervalSeconds,
  nowMilliseconds,
}: WidenDateRangeToIntervalOptions): DetectorDateRange {
  const {statsPeriod, start, end} = dateRange;

  if (statsPeriod) {
    return widenStatsPeriod(dateRange, statsPeriod, intervalSeconds);
  }

  if (start && end) {
    return widenCustomRange({
      dateRange,
      start,
      end,
      intervalSeconds,
      nowMilliseconds,
    });
  }

  return dateRange;
}

function widenStatsPeriod(
  dateRange: DetectorDateRange,
  statsPeriod: string,
  intervalSeconds: number
): DetectorDateRange {
  const periodMilliseconds = intervalToMilliseconds(statsPeriod);

  if (periodMilliseconds >= intervalSeconds * 1000) {
    return dateRange;
  }

  return getLastIntervalRange(intervalSeconds);
}

function widenCustomRange({
  dateRange,
  start,
  end,
  intervalSeconds,
  nowMilliseconds,
}: WidenCustomRangeOptions): DetectorDateRange {
  const startMilliseconds = moment.utc(start).valueOf();

  const endMilliseconds = moment.utc(end).valueOf();

  const spanMilliseconds = endMilliseconds - startMilliseconds;

  if (Number.isNaN(spanMilliseconds)) {
    return getLastIntervalRange(intervalSeconds);
  }

  const minimumSpanMilliseconds = intervalSeconds * 1000 * MINIMUM_CUSTOM_RANGE_INTERVALS;

  if (spanMilliseconds >= minimumSpanMilliseconds) {
    return dateRange;
  }

  const centerMilliseconds = startMilliseconds + spanMilliseconds / 2;

  const centeredEndMilliseconds = centerMilliseconds + minimumSpanMilliseconds / 2;

  // Clamp to now so the widened range never extends into the future
  const clampedEndMilliseconds = Math.min(centeredEndMilliseconds, nowMilliseconds);

  const widenedEndMilliseconds = floorToMinute(clampedEndMilliseconds);

  const widenedStartMilliseconds = widenedEndMilliseconds - minimumSpanMilliseconds;

  return {
    start: getUtcDateString(widenedStartMilliseconds),
    end: getUtcDateString(widenedEndMilliseconds),
    statsPeriod: undefined,
  };
}

function getLastIntervalRange(intervalSeconds: number): DetectorDateRange {
  return {
    start: undefined,
    end: undefined,
    statsPeriod: getDuration(intervalSeconds, 0, false, true),
  };
}

function floorToMinute(timestampMilliseconds: number): number {
  return Math.floor(timestampMilliseconds / MINUTE_MILLISECONDS) * MINUTE_MILLISECONDS;
}
