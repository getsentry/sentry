import {Fragment, useMemo} from 'react';
import moment from 'moment-timezone';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Dataset, TimePeriod, TimeWindow} from 'sentry/views/alerts/rules/metric/types';
import {getTimePeriodOptions} from 'sentry/views/alerts/utils/timePeriods';

type BaseOption = {label: React.ReactNode; value: TimePeriod};

const CUSTOM_TIME_VALUE = '__custom_time__';

interface TimePeriodSelectProps {
  dataset: Dataset;
  interval: number | undefined;
}

export function MetricTimePeriodSelect({dataset, interval}: TimePeriodSelectProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const start = location.query?.start as string | undefined;
  const end = location.query?.end as string | undefined;

  const hasCustomRange = Boolean(start && end);

  function mapIntervalToTimeWindow(intervalSeconds: number): TimeWindow | undefined {
    const intervalMinutes = Math.floor(intervalSeconds / 60);
    if (Object.values(TimeWindow).includes(intervalMinutes as TimeWindow)) {
      return intervalMinutes as TimeWindow;
    }
    return undefined;
  }

  const options: BaseOption[] = useMemo(() => {
    if (!dataset || !interval) {
      return [];
    }
    const timeWindow = mapIntervalToTimeWindow(interval);
    if (!timeWindow) {
      return [];
    }
    return getTimePeriodOptions({dataset, timeWindow});
  }, [dataset, interval]);

  // Determine selected period from query or fallback (prefer statsPeriod, else default 7d, else largest)
  const selected: TimePeriod = useMemo(() => {
    const urlStatsPeriod = location.query?.statsPeriod as string | undefined;
    const optionValues = new Set(options.map(o => o.value));
    if (urlStatsPeriod && optionValues.has(urlStatsPeriod as TimePeriod)) {
      return urlStatsPeriod as TimePeriod;
    }
    if (optionValues.has(TimePeriod.SEVEN_DAYS)) {
      return TimePeriod.SEVEN_DAYS;
    }
    const largestOption = options[options.length - 1];
    return (largestOption?.value as TimePeriod) ?? TimePeriod.SEVEN_DAYS;
  }, [location.query, options]);

  const selectOptions = useMemo(() => {
    if (hasCustomRange) {
      const custom = {
        label: (
          <Fragment>
            {t('Custom time')}: <DateTime date={moment.utc(start)} /> {' — '}
            <DateTime date={moment.utc(end)} />
          </Fragment>
        ),
        value: CUSTOM_TIME_VALUE,
        textValue: t('Custom time'),
        disabled: true,
      };
      return [custom, ...options];
    }

    return options;
  }, [hasCustomRange, start, end, options]);

  const value = hasCustomRange ? CUSTOM_TIME_VALUE : selected;

  return (
    <CompactSelect
      size="sm"
      options={selectOptions}
      value={value}
      onChange={opt => {
        // Ignore clicks on the custom option; only propagate real TimePeriod values
        if (opt.value === CUSTOM_TIME_VALUE) {
          return;
        }
        navigate({
          pathname: location.pathname,
          query: {
            ...location.query,
            statsPeriod: opt.value,
            start: undefined,
            end: undefined,
          },
        });
      }}
    />
  );
}
