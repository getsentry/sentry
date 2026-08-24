import {useState} from 'react';

import {useTimezone} from 'sentry/components/timezoneProvider';
import type {PageFilterDatetime} from 'sentry/types/core';

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
}: UseRelativeDateTimeOptions) {
  const timezone = useTimezone();

  const anchorTime = anchor * 1000;

  // Make sure to capture this once. Otherwise, each re-render will have
  // a different min/max date time, causing the query to refetch.
  const [maxDateTime] = useState(Date.now);
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
    utc: timezone.includes('UTC'),
    period: null,
  } satisfies PageFilterDatetime;
}
