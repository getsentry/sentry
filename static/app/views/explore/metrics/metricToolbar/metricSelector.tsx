import {useCallback, useEffect, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Tag} from '@sentry/scraps/badge/tag';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import usePrevious from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';

interface MetricSelectOption extends SelectOption<string> {
  metricName: string;
  metricType: TraceMetricTypeValue;
  metricUnit?: string;
}

export function MetricTypeBadge({metricType}: {metricType: TraceMetricTypeValue}) {
  if (!metricType) {
    return null;
  }

  return <Tag>{metricType}</Tag>;
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
      metricName: traceMetric.name,
      trailingItems: (
        <MetricTypeBadge metricType={traceMetric.type as TraceMetricTypeValue} />
      ),
    }),
    [metricSelectValue, traceMetric.name, traceMetric.type]
  );

  const metricOptions = useMemo((): MetricSelectOption[] => {
    const shouldIncludeOptionFromTraceMetric =
      traceMetric.name &&
      !metricOptionsData?.data?.some(
        option => option[TraceMetricKnownFieldKey.METRIC_NAME] === traceMetric.name
      );
    return [
      ...(shouldIncludeOptionFromTraceMetric ? [optionFromTraceMetric] : []),
      ...(metricOptionsData?.data?.map(option => ({
        label: `${option[TraceMetricKnownFieldKey.METRIC_NAME]}`,
        value: makeMetricSelectValue({
          name: option[TraceMetricKnownFieldKey.METRIC_NAME],
          type: option[TraceMetricKnownFieldKey.METRIC_TYPE] as TraceMetricTypeValue,
        }),
        metricType: option[TraceMetricKnownFieldKey.METRIC_TYPE],
        metricName: option[TraceMetricKnownFieldKey.METRIC_NAME],
        trailingItems: (
          <MetricTypeBadge metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]} />
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, traceMetric.name]);

  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !traceMetric.name) {
      onChange({
        name: metricOptions[0].metricName,
        type: metricOptions[0].metricType,
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
      searchable
      options={isFetching ? previousOptions : (metricOptions ?? [])}
      value={traceMetricSelectValue}
      loading={isFetching}
      onSearch={debouncedSetSearch}
      onChange={option => {
        if ('metricType' in option) {
          const typedOption = option as MetricSelectOption;
          onChange({
            name: typedOption.metricName,
            type: typedOption.metricType,
          });
        }
      }}
    />
  );
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}`;
}
