import {useCallback, useMemo} from 'react';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {
  ChartIntervalUnspecifiedStrategy,
  getIntervalOptionsForPageFilter,
} from 'sentry/utils/useChartInterval';
import {
  useQueryParamsInterval,
  useSetQueryParamsInterval,
} from 'sentry/views/explore/queryParams/context';

const MINIMUM_DURATION_FOR_ONE_DAY_INTERVAL = 14 * 24 * 60;
const ONE_DAY_OPTION = {value: '1d', label: t('1 day')};

export function useSpanCardInterval({
  unspecifiedStrategy = ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
}: {unspecifiedStrategy?: ChartIntervalUnspecifiedStrategy} = {}): [
  string,
  (interval: string) => void,
  Array<{label: string; value: string}>,
] {
  const pageFilters = usePageFilters();
  const storedInterval = useQueryParamsInterval();
  const setStoredInterval = useSetQueryParamsInterval();
  const {datetime} = pageFilters.selection;

  const {intervalOptions, defaultInterval} = useMemo(() => {
    const diffInMinutes = getDiffInMinutes(datetime);
    const options = getIntervalOptionsForPageFilter(datetime);

    let fallback: string;
    switch (unspecifiedStrategy) {
      case ChartIntervalUnspecifiedStrategy.USE_BIGGEST:
        fallback = options[options.length - 1]!.value;
        break;
      case ChartIntervalUnspecifiedStrategy.USE_SECOND_BIGGEST:
        fallback =
          options[options.length - 2]?.value ?? options[options.length - 1]!.value;
        break;
      case ChartIntervalUnspecifiedStrategy.USE_SMALLEST:
      default:
        fallback = options[0]!.value;
        break;
    }

    if (diffInMinutes >= MINIMUM_DURATION_FOR_ONE_DAY_INTERVAL) {
      options.push(ONE_DAY_OPTION);
    }

    return {intervalOptions: options, defaultInterval: fallback};
  }, [datetime, unspecifiedStrategy]);

  const interval = useMemo(() => {
    return storedInterval &&
      intervalOptions.some(option => option.value === storedInterval)
      ? storedInterval
      : defaultInterval;
  }, [defaultInterval, intervalOptions, storedInterval]);

  const setInterval = useCallback(
    (newInterval: string) => setStoredInterval(newInterval),
    [setStoredInterval]
  );

  return [interval, setInterval, intervalOptions];
}
