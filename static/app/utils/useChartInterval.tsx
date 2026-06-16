import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {
  FIVE_MINUTES,
  FORTY_EIGHT_HOURS,
  FOUR_DAYS,
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  SIX_HOURS,
  THIRTY_DAYS,
  TWELVE_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import {parseStatsPeriod} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export enum ChartIntervalUnspecifiedStrategy {
  /** Use the second biggest possible interval (e.g., pretty big buckets) */
  USE_SECOND_BIGGEST = 'use_second_biggest',
  /** Use the smallest possible interval (e.g., the smallest possible buckets) */
  USE_SMALLEST = 'use_smallest',
  /** Use the biggest possible interval (e.g., the biggest possible buckets) */
  USE_BIGGEST = 'use_biggest',
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

  const {baseIntervalOptions, defaultInterval, minimumIntervalInHours, timeRangeInHours} =
    useMemo(() => {
      const diffInMinutes = getDiffInMinutes(datetime);
      const options = getIntervalOptionsForPageFilter(datetime);

      // Compute the default from the ladder-derived options, before appending extras
      let fallback: string;
      switch (unspecifiedStrategy) {
        case ChartIntervalUnspecifiedStrategy.USE_SMALLEST:
          fallback = options[0]!.value;
          break;
        case ChartIntervalUnspecifiedStrategy.USE_BIGGEST:
          fallback = options[options.length - 1]!.value;
          break;
        case ChartIntervalUnspecifiedStrategy.USE_SECOND_BIGGEST:
        default:
          fallback =
            options[options.length - 2]?.value ?? options[options.length - 1]!.value;
          break;
      }

      if (diffInMinutes >= MINIMUM_DURATION_FOR_ONE_DAY_INTERVAL) {
        options.push(ONE_DAY_OPTION);
      }

      return {
        baseIntervalOptions: options,
        defaultInterval: fallback,
        // The smallest interval allowed for the current time range. Anything more
        // granular than this would produce too many buckets.
        minimumIntervalInHours: parsePeriodToHours(
          MINIMUM_INTERVAL.getInterval(diffInMinutes)
        ),
        // The full duration of the selected time range. An interval larger than
        // this would produce a single (incomplete) bucket.
        timeRangeInHours: diffInMinutes / 60,
      };
    }, [datetime, unspecifiedStrategy]);

  const [interval, intervalOptions] = useMemo((): [
    string,
    Array<{label: string; value: string}>,
  ] => {
    const decodedInterval = decodeScalar(location.query.interval);

    if (!decodedInterval) {
      return [defaultInterval, baseIntervalOptions];
    }

    // The interval is one of the standard options for this time range.
    if (baseIntervalOptions.some(option => option.value === decodedInterval)) {
      return [decodedInterval, baseIntervalOptions];
    }

    // The interval isn't a standard option (e.g. it was selected by the agent).
    // Keep it as long as it it's valid (not to granular, not too coarse).
    const decodedIntervalInHours = parsePeriodToHours(decodedInterval);
    if (
      decodedIntervalInHours >= minimumIntervalInHours &&
      decodedIntervalInHours <= timeRangeInHours
    ) {
      const options = [
        ...baseIntervalOptions,
        {value: decodedInterval, label: getIntervalLabel(decodedInterval)},
      ].sort((a, b) => parsePeriodToHours(a.value) - parsePeriodToHours(b.value));

      return [decodedInterval, options];
    }

    return [defaultInterval, baseIntervalOptions];
  }, [
    location.query.interval,
    baseIntervalOptions,
    defaultInterval,
    minimumIntervalInHours,
    timeRangeInHours,
  ]);

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
  {value: '10m', label: t('10 minutes')},
  {value: '30m', label: t('30 minutes')},
  {value: '1h', label: t('1 hour')},
  {value: '3h', label: t('3 hours')},
  {value: '6h', label: t('6 hours')},
  {value: '12h', label: t('12 hours')},
];

/**
 * The minimum interval is chosen in such a way that there will be
 * at most 1000 data points per series for the chosen period.
 */
const MINIMUM_INTERVAL = new GranularityLadder([
  [THIRTY_DAYS, '3h'],
  [TWO_WEEKS, '1h'],
  [FOUR_DAYS, '30m'],
  [FORTY_EIGHT_HOURS, '10m'],
  [TWELVE_HOURS, '5m'],
  [SIX_HOURS, '1m'],
  [0, '1m'],
]);

const MAXIMUM_INTERVAL = new GranularityLadder([
  [THIRTY_DAYS, '12h'],
  [TWO_WEEKS, '6h'],
  [FOUR_DAYS, '3h'],
  [FORTY_EIGHT_HOURS, '1h'],
  [TWELVE_HOURS, '30m'],
  [SIX_HOURS, '10m'],
  [ONE_HOUR, '5m'],
  [FIVE_MINUTES, '5m'],
  [0, '1m'],
]);

const ONE_DAY_OPTION = {value: '1d', label: t('1 day')};
const MINIMUM_DURATION_FOR_ONE_DAY_INTERVAL = TWO_WEEKS;

/**
 * Builds a human readable label for an arbitrary interval shorthand (e.g. `1d`),
 * preserving the unit chosen rather than normalizing it.
 */
function getIntervalLabel(interval: string): string {
  const parsed = parseStatsPeriod(interval);

  if (!parsed?.period || !parsed.periodLength) {
    return interval;
  }

  const value = parseInt(parsed.period, 10);

  switch (parsed.periodLength) {
    case 's':
      return tn('%s second', '%s seconds', value);
    case 'm':
      return tn('%s minute', '%s minutes', value);
    case 'h':
      return tn('%s hour', '%s hours', value);
    case 'd':
      return tn('%s day', '%s days', value);
    case 'w':
      return tn('%s week', '%s weeks', value);
    default:
      return interval;
  }
}

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
