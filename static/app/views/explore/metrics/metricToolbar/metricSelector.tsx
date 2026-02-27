import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {Tag} from '@sentry/scraps/badge';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import usePrevious from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
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
  const hasMetricUnitsUI = useHasMetricUnitsUI();

  const metricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );
  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: `${traceMetric.name}`,
      value: metricSelectValue,
      metricType: traceMetric.type as TraceMetricTypeValue,
      metricUnit: hasMetricUnitsUI ? (traceMetric.unit ?? '-') : undefined,
      metricName: traceMetric.name,
      trailingItems: () => (
        <Fragment>
          <MetricTypeBadge metricType={traceMetric.type as TraceMetricTypeValue} />
          {hasMetricUnitsUI &&
            traceMetric.unit &&
            traceMetric.unit !== '-' &&
            traceMetric.unit !== NONE_UNIT && (
              <Tag variant="promotion">{traceMetric.unit}</Tag>
            )}
        </Fragment>
      ),
    }),
    [
      metricSelectValue,
      traceMetric.name,
      traceMetric.type,
      traceMetric.unit,
      hasMetricUnitsUI,
    ]
  );

  const metricOptions = useMemo((): MetricSelectOption[] => {
    const shouldIncludeOptionFromTraceMetric =
      traceMetric.name &&
      !metricOptionsData?.data?.some(
        option =>
          makeMetricSelectValue({
            name: option[TraceMetricKnownFieldKey.METRIC_NAME],
            type: option[TraceMetricKnownFieldKey.METRIC_TYPE],
            unit: hasMetricUnitsUI
              ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
              : undefined,
          }) === makeMetricSelectValue(traceMetric)
      );
    return [
      ...(shouldIncludeOptionFromTraceMetric ? [optionFromTraceMetric] : []),
      ...(metricOptionsData?.data?.map(option => ({
        label: `${option[TraceMetricKnownFieldKey.METRIC_NAME]}`,
        value: makeMetricSelectValue({
          name: option[TraceMetricKnownFieldKey.METRIC_NAME],
          type: option[TraceMetricKnownFieldKey.METRIC_TYPE] as TraceMetricTypeValue,
          unit: hasMetricUnitsUI
            ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
            : undefined,
        }),
        metricType: option[TraceMetricKnownFieldKey.METRIC_TYPE],
        metricName: option[TraceMetricKnownFieldKey.METRIC_NAME],
        metricUnit: hasMetricUnitsUI
          ? (option[TraceMetricKnownFieldKey.METRIC_UNIT] ?? NONE_UNIT)
          : undefined,
        trailingItems: () => (
          <Fragment>
            <MetricTypeBadge metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]} />
            {option[TraceMetricKnownFieldKey.METRIC_UNIT] && (
              <Tag variant="promotion">
                {option[TraceMetricKnownFieldKey.METRIC_UNIT]}
              </Tag>
            )}
          </Fragment>
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, traceMetric, hasMetricUnitsUI]);

  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !traceMetric.name) {
      onChange({
        name: metricOptions[0].metricName,
        type: metricOptions[0].metricType,
        unit: hasMetricUnitsUI ? (metricOptions[0].metricUnit ?? NONE_UNIT) : undefined,
      });
    }
  }, [metricOptions, onChange, traceMetric.name, hasMetricUnitsUI]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setSearch(newSearch);
    }, DEFAULT_DEBOUNCE_DURATION),
    [setSearch]
  );

  const traceMetricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? traceMetric : {name: traceMetric.name, type: traceMetric.type}
  );
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
            unit: hasMetricUnitsUI ? typedOption.metricUnit : undefined,
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
