import {useRef} from 'react';
import moment from 'moment';

import {intervalToMilliseconds} from 'sentry/utils/dates';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getConfigFromTimeRange} from 'sentry/views/monitors/components/overviewTimeline/utils';

import type {TimeWindowConfig} from '../components/overviewTimeline/types';

interface Options {
  /**
   * The width of the timeline influences ho we caluclate the rollup value
   */
  timelineWidth: number;
}

interface Dates {
  end: Date;
  start: Date;
}

interface SelectionQuery {
  resolution: string;
  since: number;
  until: number;
}

interface UseMonitorTimesResult {
  /**
   * Contains Date objects representing the start and end times of the
   * selection.
   */
  dates: Dates;
  /**
   * Contains values used in the monitor-stats API query
   */
  selectionQuery: SelectionQuery;
  /**
   * The computed timeWindowConfig
   */
  timeWindowConfig: TimeWindowConfig;
}

/**
 * Computes since, until, and resolution for monitor stats based on the current
 * selected page filters.
 */
export function useMonitorTimes({timelineWidth}: Options): UseMonitorTimesResult {
  const nowRef = useRef<Date>(new Date());
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;

  let since: Date;
  let until: Date;

  if (!start || !end) {
    until = nowRef.current;
    since = moment(nowRef.current)
      .subtract(intervalToMilliseconds(period ?? '24h'), 'milliseconds')
      .toDate();
  } else {
    since = new Date(start);
    until = new Date(end);
  }

  const timeWindowConfig = getConfigFromTimeRange(since, until, timelineWidth);

  const elapsedMinutes = timeWindowConfig.elapsedMinutes;
  const rollup = Math.floor((elapsedMinutes * 60) / timelineWidth);

  const dates = {
    start: since,
    end: until,
  };

  const selectionQuery = {
    since: Math.floor(since.getTime() / 1000),
    until: Math.floor(until.getTime() / 1000),
    resolution: `${rollup}s`,
  };

  return {selectionQuery, dates, timeWindowConfig};
}
