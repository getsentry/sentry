import {useMemo} from 'react';

import {getConfigFromTimeRange} from '../utils/getConfigFromTimeRange';

import {useMonitorDates} from './useMonitorDates';

interface Options {
  /**
   * The width of the timeline influences how we calculate the rollup value
   */
  timelineWidth: number;
}

export function useTimeWindowConfig({timelineWidth}: Options) {
  const {since, until} = useMonitorDates();

  return useMemo(
    () => getConfigFromTimeRange(since, until, timelineWidth),
    [since, until, timelineWidth]
  );
}
