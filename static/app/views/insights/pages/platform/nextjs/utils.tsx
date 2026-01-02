import type {DateTimeObject} from 'sentry/components/charts/utils';
import {
  parseStatsPeriod,
  type StatsPeriodType,
} from 'sentry/components/organizations/pageFilters/parse';
import type {DateString} from 'sentry/types/core';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {unreachable} from 'sentry/utils/unreachable';

const MAX_PERIOD_HOURS = 14 * 24;

type AbsoluteDateTimeObject = {
  end: DateString;
  start: DateString;
};

export function getPreviousPeriod({period, start, end}: DateTimeObject) {
  if (start && end) {
    return doGetPreviousPeriod({start, end});
  }

  if (period) {
    const currentEnd = new Date();
    const currentStart = new Date(
      currentEnd.getTime() - parsePeriodToHours(period) * 60 * 60 * 1000
    );
    const previous = doGetPreviousPeriod({start: currentStart, end: currentEnd});
    const periodLength = parseStatsPeriod(period)?.periodLength;

    return previous && periodLength ? truncatePeriod(previous, periodLength) : null;
  }

  return null;
}

const doGetPreviousPeriod = ({start, end}: AbsoluteDateTimeObject) => {
  if (!start || !end) {
    return null;
  }

  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (duration > MAX_PERIOD_HOURS * 60 * 60 * 1000) {
    return null;
  }

  const newEnd = new Date(start);
  const newStart = new Date(new Date(start).getTime() - duration);

  return {
    start: newStart,
    end: newEnd,
  };
};

export const truncatePeriod = (
  {start, end}: {end: Date | null; start: Date | null},
  periodType: StatsPeriodType
) => {
  const truncateDate = (date: Date): string => {
    // Create a new date to avoid mutating the original
    const newDate = new Date(date);

    switch (periodType) {
      case 's': // seconds - no truncation needed, already at seconds precision
        newDate.setUTCMilliseconds(0);
        break;
      case 'm': // minutes and hours - truncate seconds and milliseconds
      case 'h':
        newDate.setUTCSeconds(0, 0);
        break;
      case 'd': // above hours - truncate minutes, seconds, and milliseconds
      case 'w':
        newDate.setUTCMinutes(0, 0, 0);
        break;
      default:
        unreachable(periodType);
    }

    return newDate.toISOString();
  };

  if (!start || !end) {
    return null;
  }

  return {
    start: truncateDate(start),
    end: truncateDate(end),
  };
};
