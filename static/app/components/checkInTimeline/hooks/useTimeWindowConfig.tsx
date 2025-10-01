import {useMemo} from 'react';

import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';

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
}

export function useTimeWindowConfig({
  timelineWidth,
  recomputeInterval,
  recomputeOnWindowFocus,
}: Options) {
  const {since, until} = usePageFilterDates({recomputeInterval, recomputeOnWindowFocus});

  return useMemo(
    () => getConfigFromTimeRange(since, until, timelineWidth),
    [since, until, timelineWidth]
  );
}
