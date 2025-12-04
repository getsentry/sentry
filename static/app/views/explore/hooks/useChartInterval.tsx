import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {
  FIVE_MINUTES,
  FORTY_EIGHT_HOURS,
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  ONE_WEEK,
  SIX_HOURS,
  THIRTY_DAYS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';

enum ChartIntervalUnspecifiedStrategy {
  /** Use the second biggest possible interval (e.g., pretty big buckets) */
  USE_SECOND_BIGGEST = 'use_second_biggest',
  /** Use the smallest possible interval (e.g., the smallest possible buckets) */
  USE_SMALLEST = 'use_smallest',
}

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  pagefilters: ReturnType<typeof usePageFilters>;
  unspecifiedStrategy?: ChartIntervalUnspecifiedStrategy;
}

export function useChartInterval({
  unspecifiedStrategy = ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
}: {unspecifiedStrategy?: ChartIntervalUnspecifiedStrategy} = {}): [
  string,
  (interval: string) => void,
  intervalOptions: Array<{label: string; value: string}>,
] {
  const location = useLocation();
  const navigate = useNavigate();
  const pagefilters = usePageFilters();

  return useChartIntervalImpl({
    location,
    navigate,
    pagefilters,
    unspecifiedStrategy,
  });
}

function useChartIntervalImpl({
  location,
  navigate,
  pagefilters,
  unspecifiedStrategy,
}: Options): [
  string,
  (interval: string) => void,
  intervalOptions: Array<{label: string; value: string}>,
] {
  const {datetime} = pagefilters.selection;
  const intervalOptions = useMemo(
    () => getIntervalOptionsForPageFilter(datetime),
    [datetime]
  );

  const interval: string = useMemo(() => {
    const decodedInterval = decodeScalar(location.query.interval);

    // Default to the second largest option or largest option
    const fallbackInterval =
      unspecifiedStrategy === ChartIntervalUnspecifiedStrategy.USE_SMALLEST
        ? intervalOptions[0]!.value
        : (intervalOptions[intervalOptions.length - 2]?.value ??
          intervalOptions[intervalOptions.length - 1]!.value);

    return decodedInterval &&
      intervalOptions.some(option => option.value === decodedInterval)
      ? decodedInterval
      : fallbackInterval;
  }, [location.query.interval, unspecifiedStrategy, intervalOptions]);

  const setInterval = useCallback(
    (newInterval: string) => {
      navigate({
        ...location,
        query: {
          ...location.query,
          interval: newInterval,
        },
      });
    },
    [location, navigate]
  );

  return [interval, setInterval, intervalOptions];
}

const ALL_INTERVAL_OPTIONS = [
  {value: '1m', label: t('1 minute')},
  {value: '5m', label: t('5 minutes')},
  {value: '15m', label: t('15 minutes')},
  {value: '30m', label: t('30 minutes')},
  {value: '1h', label: t('1 hour')},
  {value: '3h', label: t('3 hours')},
  {value: '12h', label: t('12 hours')},
  {value: '1d', label: t('1 day')},
];

/**
 * The minimum interval is chosen in such a way that there will be
 * at most 1000 data points per series for the chosen period.
 */
const MINIMUM_INTERVAL = new GranularityLadder([
  [THIRTY_DAYS, '3h'],
  [TWO_WEEKS, '1h'],
  [ONE_WEEK, '30m'],
  [FORTY_EIGHT_HOURS, '15m'],
  [SIX_HOURS, '5m'],
  [0, '1m'],
]);

const MAXIMUM_INTERVAL = new GranularityLadder([
  [THIRTY_DAYS, '1d'],
  [TWO_WEEKS, '1d'],
  [ONE_WEEK, '12h'],
  [FORTY_EIGHT_HOURS, '4h'],
  [SIX_HOURS, '1h'],
  [ONE_HOUR, '15m'],
  [FIVE_MINUTES, '5m'],
  [0, '1m'],
]);

export function getIntervalOptionsForPageFilter(datetime: PageFilters['datetime']) {
  const diffInMinutes = getDiffInMinutes(datetime);

  const minimumOption = MINIMUM_INTERVAL.getInterval(diffInMinutes);
  const minimumOptionInHours = parsePeriodToHours(minimumOption);

  const maximumOption = MAXIMUM_INTERVAL.getInterval(diffInMinutes);
  const maximumOptionInHours = parsePeriodToHours(maximumOption);

  return ALL_INTERVAL_OPTIONS.filter(option => {
    const optionInHours = parsePeriodToHours(option.value);
    return optionInHours >= minimumOptionInHours && optionInHours <= maximumOptionInHours;
  });
}
