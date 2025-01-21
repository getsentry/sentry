import {useRef} from 'react';
import moment from 'moment-timezone';

import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import usePageFilters from 'sentry/utils/usePageFilters';

/**
 * Computes since and until values from the current page filters
 */
export function usePageFilterDates() {
  const nowRef = useRef<Date>(moment().startOf('minute').add(1, 'minutes').toDate());
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;

  let since: Date;
  let until: Date;

  if (!start || !end) {
    const periodMs = intervalToMilliseconds(period ?? '24h');
    until = nowRef.current;
    since = moment(nowRef.current).subtract(periodMs, 'milliseconds').toDate();
  } else {
    since = new Date(start);
    until = new Date(end);
  }

  return {since, until, nowRef};
}
