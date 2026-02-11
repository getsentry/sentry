import {useCallback} from 'react';
import moment from 'moment-timezone';

import {updateDateTime} from 'sentry/components/pageFilters/actions';
import getDuration from 'sentry/utils/duration/getDuration';
import useRouter from 'sentry/utils/useRouter';

import {usePageFilterDates} from './useMonitorDates';

export interface DateNavigation {
  /**
   * Is the windows end aligned to the current time?
   */
  endIsNow: boolean;
  /**
   * A duration label indicating how far the navigation will navigate
   */
  label: React.ReactNode;
  /**
   * Updates the page filter date range to the next period using the current
   * period as a reference.
   */
  navigateToNextPeriod: () => void;
  /**
   * Updates the page filter date range to the previous period using the
   * current period as a reference.
   */
  navigateToPreviousPeriod: () => void;
}

export function useDateNavigation(): DateNavigation {
  const router = useRouter();
  const {since, until, now} = usePageFilterDates();

  const windowMs = until.getTime() - since.getTime();

  const navigateToPreviousPeriod = useCallback(() => {
    const nextUntil = moment(until).subtract(windowMs, 'milliseconds');
    const nextSince = moment(nextUntil).subtract(windowMs, 'milliseconds');

    updateDateTime({start: nextSince.toDate(), end: nextUntil.toDate()}, router);
  }, [windowMs, router, until]);

  const navigateToNextPeriod = useCallback(() => {
    // Do not navigate past the current time
    const nextUntil = moment.min(
      moment(until).add(windowMs, 'milliseconds'),
      moment(now)
    );
    const nextSince = moment(nextUntil).subtract(windowMs, 'milliseconds');

    updateDateTime({start: nextSince.toDate(), end: nextUntil.toDate()}, router, {
      keepCursor: true,
    });
  }, [until, windowMs, now, router]);

  return {
    endIsNow: until.getTime() === now.getTime(),
    label: getDuration(windowMs / 1000),
    navigateToPreviousPeriod,
    navigateToNextPeriod,
  };
}
