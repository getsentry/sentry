import {Fragment, useEffect, useMemo} from 'react';
import moment from 'moment-timezone';

import {CompactSelect} from '@sentry/scraps/compactSelect';

import {DateTime} from 'sentry/components/dateTime';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  useDetectorResolvedStatsPeriod,
  useDetectorTimePeriodOptions,
} from 'sentry/views/detectors/components/details/metric/utils/useDetectorTimePeriods';
import type {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {MetricDetectorTimePeriod} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';

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

  const options: BaseOption[] = useDetectorTimePeriodOptions({
    dataset,
    intervalSeconds: interval,
  });

  // Determine selected period from query or fallback to largest option
  const selected: MetricDetectorTimePeriod = useDetectorResolvedStatsPeriod({
    dataset,
    intervalSeconds: interval,
    urlStatsPeriod: location.query?.statsPeriod as string | undefined,
  });

  // If there is no time selection in the URL, sync the resolved default period
  // into the query params so that the rest of the page (chart, links, etc.)
  // has a consistent source of truth.
  useEffect(() => {
    const hasStatsPeriod = Boolean(location.query?.statsPeriod);
    if (!hasCustomRange && !hasStatsPeriod && selected) {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            statsPeriod: selected,
            start: undefined,
            end: undefined,
          },
        },
        {replace: true}
      );
    }
  }, [hasCustomRange, selected, navigate, location.pathname, location.query]);

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
