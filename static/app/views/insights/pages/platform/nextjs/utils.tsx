import type {DateTimeObject} from 'sentry/components/charts/utils';
import type {DateString} from 'sentry/types/core';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

const MAX_PERIOD_HOURS = 14 * 24;

type AbsoluteDateTimeObject = {
  end: DateString;
  start: DateString;
};

export function getPreviousPeriod({
  period,
  start,
  end,
}: DateTimeObject): AbsoluteDateTimeObject | null {
  if (start && end) {
    return doGetPreviousPeriod({start, end});
  }

  if (period) {
    const currentEnd = new Date();
    const currentStart = new Date(
      currentEnd.getTime() - parsePeriodToHours(period) * 60 * 60 * 1000
    );
    return doGetPreviousPeriod({start: currentStart, end: currentEnd});
  }

  return null;
}

const doGetPreviousPeriod = ({
  start,
  end,
}: AbsoluteDateTimeObject): AbsoluteDateTimeObject | null => {
  if (!start || !end) {
    return null;
  }

  const duration = new Date(end).getTime() - new Date(start).getTime();
  if (duration > MAX_PERIOD_HOURS * 60 * 60 * 1000) {
    return null;
  }

  const newEnd = new Date(start).toISOString();
  const newStart = new Date(new Date(start).getTime() - duration).toISOString();

  return {
    start: newStart,
    end: newEnd,
  };
};
