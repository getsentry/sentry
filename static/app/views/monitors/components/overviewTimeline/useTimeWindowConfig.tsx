import {useMonitorDates} from './useMonitorDates';
import {getConfigFromTimeRange} from './utils';

interface Options {
  /**
   * The width of the timeline influences how we calculate the rollup value
   */
  timelineWidth: number;
}

export function useTimeWindowConfig({timelineWidth}: Options) {
  const {since, until} = useMonitorDates();

  return getConfigFromTimeRange(since, until, timelineWidth);
}
