import {useCallback, useMemo} from 'react';

import {
  getDiffInMinutes,
  GranularityLadder,
  ONE_HOUR,
  ONE_WEEK,
  SIXTY_DAYS,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
  TWO_WEEKS,
} from 'sentry/components/charts/utils';
import {parseStatsPeriod} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {useUpdateQuery} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {MetricQueryType} from 'sentry/utils/metrics/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useDDMContext} from 'sentry/views/ddm/context';

const ALL_INTERVAL_OPTIONS = [
  '10s',
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '3h',
  '6h',
  '12h',
  '24h',
  '2d',
  '7d',
];

const smallestGranulariy = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '2h'],
  [TWO_WEEKS, '1h'],
  [ONE_WEEK, '30m'],
  [TWENTY_FOUR_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '1m'],
]);

function getIntervalOptionsForStatsPeriod(
  datetime: PageFilters['datetime'],
  isCustomMetricsOnly: boolean
) {
  const diffInMinutes = getDiffInMinutes(datetime);
  const diffInHours = diffInMinutes / 60;

  const minimumOption =
    // BE returns empty timeseries if we request less than 1 minute granularity
    // for other data sets than custom metrics
    isCustomMetricsOnly && diffInHours <= 1
      ? '10s'
      : smallestGranulariy.getInterval(diffInMinutes);
  const minimumOptionInHours = parsePeriodToHours(minimumOption);

  return ALL_INTERVAL_OPTIONS.filter(option => {
    const optionInHours = parsePeriodToHours(option);
    return optionInHours >= minimumOptionInHours && optionInHours <= diffInHours;
  });
}

export function useMetricsIntervalParam() {
  const {datetime} = usePageFilters().selection;
  const {interval} = useLocationQuery({fields: {interval: decodeScalar}});
  const {widgets} = useDDMContext();

  const isCustomMetricsOnly = useMemo(() => {
    return widgets.every(
      widget =>
        widget.type === MetricQueryType.FORMULA ||
        parseMRI(widget.mri)?.useCase === 'custom'
    );
  }, [widgets]);

  const currentIntervalOptions = useMemo(
    () => getIntervalOptionsForStatsPeriod(datetime, isCustomMetricsOnly),
    [datetime, isCustomMetricsOnly]
  );

  const updateQuery = useUpdateQuery();
  const setInterval = useCallback(
    (newInterval: string) => {
      updateQuery({interval: newInterval}, {replace: true});
    },
    [updateQuery]
  );

  const validatedInterval = useMemo(() => {
    const isPeriod = !!parseStatsPeriod(interval);
    // TODO: check if interval is in current range
    return isPeriod && currentIntervalOptions.includes(interval)
      ? interval
      : currentIntervalOptions[0];
  }, [currentIntervalOptions, interval]);

  return {
    interval: validatedInterval,
    setInterval,
    currentIntervalOptions,
  };
}
