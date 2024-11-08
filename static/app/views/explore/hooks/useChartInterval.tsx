import {useCallback, useMemo} from 'react';
import type {Location} from 'history';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getIntervalOptionsForStatsPeriod} from 'sentry/views/metrics/utils/useMetricsIntervalParam';

interface Options {
  location: Location;
  navigate: ReturnType<typeof useNavigate>;
  pagefilters: ReturnType<typeof usePageFilters>;
}

export function useChartInterval(): [
  string,
  (interval: string) => void,
  intervalOptions: {label: string; value: string}[],
] {
  const location = useLocation();
  const navigate = useNavigate();
  const pagefilters = usePageFilters();
  const options = {location, navigate, pagefilters};

  return useChartIntervalImpl(options);
}

function useChartIntervalImpl({
  location,
  navigate,
  pagefilters,
}: Options): [
  string,
  (interval: string) => void,
  intervalOptions: {label: string; value: string}[],
] {
  const {datetime} = pagefilters.selection;
  const intervalOptions = useMemo(() => {
    return getIntervalOptionsForStatsPeriod(datetime);
  }, [datetime]);

  const interval: string = useMemo(() => {
    const decodedInterval = decodeScalar(location.query.interval);

    return decodedInterval &&
      intervalOptions.some(option => option.value === decodedInterval)
      ? decodedInterval
      : intervalOptions[0].value;
  }, [location.query.interval, intervalOptions]);

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
