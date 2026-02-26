import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Tag} from '@sentry/scraps/badge';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import usePrevious from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';

export const NONE_UNIT = 'none';

interface MetricSelectOption extends SelectOption<string> {
  metricName: string;
  metricType: TraceMetricTypeValue;
  metricUnit?: string;
}

export function MetricSelector({
  traceMetric,
  onChange,
}: {
  onChange: (traceMetric: TraceMetric) => void;
  traceMetric: TraceMetric;
}) {
  const [search, setSearch] = useState('');
  const {data: metricOptionsData, isFetching} = useMetricOptions({search});

  const metricSelectValue = makeMetricSelectValue(traceMetric);
  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: `${traceMetric.name}`,
      value: metricSelectValue,
      metricType: traceMetric.type as TraceMetricTypeValue,
      metricUnit: traceMetric.unit ?? '-',
      metricName: traceMetric.name,
      trailingItems: () => (
        <Fragment>
          <MetricTypeBadge metricType={traceMetric.type as TraceMetricTypeValue} />
          {traceMetric.unit && traceMetric.unit !== '-' && (
            <Tag variant={traceMetric.unit === NONE_UNIT ? 'muted' : 'promotion'}>
              {traceMetric.unit ?? NONE_UNIT}
            </Tag>
          )}
        </Fragment>
      ),
    }),
    [metricSelectValue, traceMetric.name, traceMetric.type, traceMetric.unit]
  );

  const metricOptions = useMemo((): MetricSelectOption[] => {
    const shouldIncludeOptionFromTraceMetric =
      traceMetric.name &&
      !metricOptionsData?.data?.some(
        option =>
          makeMetricSelectValue({
            name: option[TraceMetricKnownFieldKey.METRIC_NAME],
            type: option[TraceMetricKnownFieldKey.METRIC_TYPE],
            unit: option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT,
          }) === makeMetricSelectValue(traceMetric)
      );
    return [
      ...(shouldIncludeOptionFromTraceMetric ? [optionFromTraceMetric] : []),
      ...(metricOptionsData?.data?.map(option => ({
        label: `${option[TraceMetricKnownFieldKey.METRIC_NAME]}`,
        value: makeMetricSelectValue({
          name: option[TraceMetricKnownFieldKey.METRIC_NAME],
          type: option[TraceMetricKnownFieldKey.METRIC_TYPE] as TraceMetricTypeValue,
          unit: option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT,
        }),
        metricType: option[TraceMetricKnownFieldKey.METRIC_TYPE],
        metricName: option[TraceMetricKnownFieldKey.METRIC_NAME],
        metricUnit: option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT,
        trailingItems: () => (
          <Fragment>
            <MetricTypeBadge metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]} />
            <Tag
              variant={
                option[TraceMetricKnownFieldKey.METRIC_UNIT] ? 'promotion' : 'muted'
              }
            >
              {option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT}
            </Tag>
          </Fragment>
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, traceMetric]);

  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !traceMetric.name) {
      onChange({
        name: metricOptions[0].metricName,
        type: metricOptions[0].metricType,
        unit: metricOptions[0].metricUnit,
      });
    }
  }, [metricOptions, onChange, traceMetric.name]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setSearch(newSearch);
    }, DEFAULT_DEBOUNCE_DURATION),
    [setSearch]
  );

  const traceMetricSelectValue = makeMetricSelectValue(traceMetric);
  const previousOptions = usePrevious(metricOptions ?? []);

  return (
    <CompactSelect
      virtualizeThreshold={100}
      search={{onChange: debouncedSetSearch}}
      options={isFetching ? previousOptions : (metricOptions ?? [])}
      value={traceMetricSelectValue}
      loading={isFetching}
      menuTitle={t('Metrics')}
      onChange={option => {
        if ('metricType' in option) {
          const typedOption = option as MetricSelectOption;
          onChange({
            name: typedOption.metricName,
            type: typedOption.metricType,
            unit: typedOption.metricUnit,
          });
        }
      }}
      style={{width: '100%'}}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          style={{width: '100%', fontWeight: 'bold'}}
        />
      )}
    />
  );
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}||${metric.unit ?? '-'}`;
}
