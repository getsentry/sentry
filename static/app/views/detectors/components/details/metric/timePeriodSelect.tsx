import {Fragment, useMemo} from 'react';
import moment from 'moment-timezone';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import type {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {
  getTimePeriodLabel,
  MetricDetectorInterval,
  MetricDetectorTimePeriod,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';

type BaseOption = {label: React.ReactNode; value: MetricDetectorTimePeriod};

const CUSTOM_TIME_VALUE = '__custom_time__';

interface TimePeriodSelectProps {
  dataset: DetectorDataset;
  interval: number | undefined;
}

export function MetricTimePeriodSelect({dataset, interval}: TimePeriodSelectProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const start = location.query?.start as string | undefined;
  const end = location.query?.end as string | undefined;

  const hasCustomRange = Boolean(start && end);

  function mapIntervalToMetricInterval(
    intervalSeconds: number
  ): MetricDetectorInterval | undefined {
    const intervalMinutes = Math.floor(intervalSeconds / 60);
    const validIntervals = Object.values(MetricDetectorInterval).filter(
      value => typeof value === 'number'
    );
    if (validIntervals.includes(intervalMinutes)) {
      return intervalMinutes as MetricDetectorInterval;
    }
    return undefined;
  }

  const options: BaseOption[] = useMemo(() => {
    if (!dataset || !interval) {
      return [];
    }
    const metricInterval = mapIntervalToMetricInterval(interval);
    if (!metricInterval) {
      return [];
    }
    const datasetConfig = getDatasetConfig(dataset);
    const timePeriods = datasetConfig.getTimePeriods(metricInterval);
    return timePeriods.map(period => ({
      value: period,
      label: getTimePeriodLabel(period),
    }));
  }, [dataset, interval]);

  // Determine selected period from query or fallback (prefer statsPeriod, else default 7d, else largest)
  const selected: MetricDetectorTimePeriod = useMemo(() => {
    const urlStatsPeriod = location.query?.statsPeriod as string | undefined;
    const optionValues = new Set(options.map(o => o.value));
    if (
      urlStatsPeriod &&
      optionValues.has(urlStatsPeriod as unknown as MetricDetectorTimePeriod)
    ) {
      return urlStatsPeriod as unknown as MetricDetectorTimePeriod;
    }
    if (optionValues.has(MetricDetectorTimePeriod.SEVEN_DAYS)) {
      return MetricDetectorTimePeriod.SEVEN_DAYS;
    }
    const largestOption = options[options.length - 1];
    return (
      (largestOption?.value as MetricDetectorTimePeriod) ??
      MetricDetectorTimePeriod.SEVEN_DAYS
    );
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
