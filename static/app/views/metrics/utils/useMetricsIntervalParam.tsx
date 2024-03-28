import {useCallback, useEffect, useMemo} from 'react';

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
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {useUpdateQuery} from 'sentry/utils/metrics';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {isMetricsEquationWidget} from 'sentry/utils/metrics/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useMetricsContext} from 'sentry/views/metrics/context';

const ALL_INTERVAL_OPTIONS = [
  {value: '10s', label: t('10 seconds')},
  {value: '1m', label: t('1 minute')},
  {value: '5m', label: t('5 minutes')},
  {value: '15m', label: t('15 minutes')},
  {value: '30m', label: t('30 minutes')},
  {value: '1h', label: t('1 hour')},
  {value: '4h', label: t('4 hours')},
  {value: '1d', label: t('1 day')},
  {value: '1w', label: t('1 week')},
  {value: '4w', label: t('1 month')},
];

const minimumInterval = new GranularityLadder([
  [SIXTY_DAYS, '1d'],
  [THIRTY_DAYS, '2h'],
  [TWO_WEEKS, '1h'],
  [ONE_WEEK, '30m'],
  [TWENTY_FOUR_HOURS, '5m'],
  [ONE_HOUR, '1m'],
  [0, '1m'],
]);

const maximumInterval = new GranularityLadder([
  [SIXTY_DAYS, '4w'],
  [THIRTY_DAYS, '1w'],
  [TWO_WEEKS, '1w'],
  [ONE_WEEK, '1d'],
  [TWENTY_FOUR_HOURS, '6h'],
  [ONE_HOUR, '15m'],
  [0, '1m'],
]);

export function getIntervalOptionsForStatsPeriod(
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
      : minimumInterval.getInterval(diffInMinutes);
  const minimumOptionInHours = parsePeriodToHours(minimumOption);

  const maximumOption = maximumInterval.getInterval(diffInMinutes);
  const maximumOptionInHours = parsePeriodToHours(maximumOption);

  return ALL_INTERVAL_OPTIONS.filter(option => {
    const optionInHours = parsePeriodToHours(option.value);
    return optionInHours >= minimumOptionInHours && optionInHours <= maximumOptionInHours;
  });
}

export function useMetricsIntervalParam() {
  const {datetime} = usePageFilters().selection;
  const {interval} = useLocationQuery({fields: {interval: decodeScalar}});
  const {widgets} = useMetricsContext();

  const isCustomMetricsOnly = useMemo(() => {
    return widgets.every(
      widget =>
        isMetricsEquationWidget(widget) || parseMRI(widget.mri)?.useCase === 'custom'
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
    const currentIntervalValues = currentIntervalOptions.map(option => option.value);
    return isPeriod && currentIntervalValues.includes(interval)
      ? interval
      : // Take the 2nd most granular option if available
        currentIntervalOptions[1]?.value ?? currentIntervalOptions[0].value;
  }, [currentIntervalOptions, interval]);

  useEffect(() => {
    if (interval !== validatedInterval) {
      setInterval(validatedInterval);
    }
  }, [interval, validatedInterval, setInterval]);

  return {
    interval: validatedInterval,
    setInterval,
    currentIntervalOptions,
  };
}
