import moment from 'moment-timezone';

import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useQuery} from 'sentry/utils/queryClient';

interface UsePageFilterDatesOptions {
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

/**
 * Computes since and until values from the current page filters
 */
export function usePageFilterDates(options: UsePageFilterDatesOptions = {}) {
  const {recomputeInterval, recomputeOnWindowFocus = false, recomputeQueryKey} = options;
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;

  function queryFn() {
    const now = moment().startOf('minute').add(1, 'minutes').toDate();

    let since: Date;
    let until: Date;

    if (!start || !end) {
      const periodMs = intervalToMilliseconds(period ?? '24h');
      until = now;
      since = moment(now).subtract(periodMs, 'milliseconds').toDate();
    } else {
      since = new Date(start);
      until = new Date(end);
    }

    return {since, until, now};
  }

  const queryKeyExtra = recomputeQueryKey ?? [];

  const {data} = useQuery({
    queryKey: ['pageFilterDates', start, end, period, ...queryKeyExtra] as const,
    queryFn,
    initialData: queryFn(),
    staleTime: 0,
    refetchInterval: recomputeInterval,
    refetchOnWindowFocus: recomputeOnWindowFocus,
  });

  return data;
}
