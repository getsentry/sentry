import {useMemo} from 'react';

import {PageFilters} from 'sentry/types';
import {getUserTimezone} from 'sentry/utils/dates';

const DAY = 24 * 60 * 60 * 1000;

interface UseRelativeDateTimeOptions {
  anchor: number;
  relativeDays: number;
  retentionDays?: number;
}

export function useRelativeDateTime({
  anchor,
  relativeDays,
  retentionDays,
}: UseRelativeDateTimeOptions): PageFilters['datetime'] {
  const anchorTime = anchor * 1000;

  // Make sure to memo this. Otherwise, each re-render will have
  // a different min/max date time, causing the query to refetch.
  const maxDateTime = useMemo(() => Date.now(), []);
  const minDateTime = maxDateTime - (retentionDays ?? 90) * DAY;

  const beforeTime = anchorTime - relativeDays * DAY;
  const beforeDateTime =
    beforeTime >= minDateTime ? new Date(beforeTime) : new Date(minDateTime);

  const afterTime = anchorTime + relativeDays * DAY;
  const afterDateTime =
    afterTime <= maxDateTime ? new Date(afterTime) : new Date(maxDateTime);

  return {
    start: beforeDateTime,
    end: afterDateTime,
    utc: getUserTimezone() === 'UTC',
    period: null,
  };
}
