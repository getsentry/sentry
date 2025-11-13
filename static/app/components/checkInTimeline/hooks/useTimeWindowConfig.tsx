import {useMemo} from 'react';

import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import {useTimezone} from 'sentry/components/timezoneProvider';

import {usePageFilterDates} from './useMonitorDates';

interface Options {
  /**
   * The width of the timeline influences how we calculate the rollup value
   */
  timelineWidth: number;
  /**
   * Interval in milliseconds to recompute the dates (for relative time periods)
   */
  recomputeInterval?: number;
  /**
   * Whether to recompute dates when the window regains focus
   */
  recomputeOnWindowFocus?: boolean;
  /**
   * This array may be provided as a queryKey to the underlying useQuery that will
   * force the dates to be recomputed when the key changes.
   */
  recomputeQueryKey?: unknown[];
}

export function useTimeWindowConfig({
  timelineWidth,
  recomputeInterval,
  recomputeOnWindowFocus,
  recomputeQueryKey,
}: Options) {
  const timezone = useTimezone();
  const {since, until} = usePageFilterDates({
    recomputeInterval,
    recomputeOnWindowFocus,
    recomputeQueryKey,
  });

  return useMemo(
    () => getConfigFromTimeRange(since, until, timelineWidth, timezone),
    [since, until, timelineWidth, timezone]
  );
}
