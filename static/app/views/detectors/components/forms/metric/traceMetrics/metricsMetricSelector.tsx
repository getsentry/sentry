import type {ReactNode} from 'react';
import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Tag} from '@sentry/scraps/badge';
import {
  CompactSelect,
  type SelectKey,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {usePrevious} from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useHasMetricUnitsUI} from 'sentry/views/explore/metrics/hooks/useHasMetricUnitsUI';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {NONE_UNIT} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';

interface MetricSelectOption extends SelectOption<string> {
  metricName: string;
  metricType: TraceMetricTypeValue;
  trailingItems: ReactNode;
  metricUnit?: string;
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}||${metric.unit ?? '-'}`;
}

interface Props {
  onChange: (metric: TraceMetric) => void;
  value: TraceMetric;
  disabled?: boolean;
  environment?: string | null;
  projectId?: string;
}

/**
 * Controlled metric dropdown for trace metric pickers. Fetches metric options
 * scoped to `projectId` / `environment`, debounces user search, and emits the
 * chosen `TraceMetric` via `onChange`.
 *
 * Auto-selects the first available metric when `value.name` is empty and the
 * options have loaded — so consumers can render this with an empty default
 * and let it populate itself.
 */
export function MetricsMetricSelector({
  value,
  onChange,
  disabled,
  environment,
  projectId,
}: Props) {
  const hasMetricUnitsUI = useHasMetricUnitsUI();
  const [search, setSearch] = useState('');

  const {
    data: metricOptionsData,
    isFetching,
    isMetricOptionsEmpty,
  } = useMetricOptions({
    search,
    projectIds: projectId ? [parseInt(projectId, 10)] : undefined,
    environments: environment ? [environment] : undefined,
  });

  const metricSelectValue = makeMetricSelectValue(
    hasMetricUnitsUI ? value : {name: value.name, type: value.type}
  );

  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: value.name || t('Select a metric'),
      value: metricSelectValue,
      metricType: value.type as TraceMetricTypeValue,
      metricName: value.name,
      metricUnit: hasMetricUnitsUI ? (value.unit ?? NONE_UNIT) : undefined,
      trailingItems: (
        <Fragment>
          <MetricTypeBadge metricType={value.type as TraceMetricTypeValue} />
          {hasMetricUnitsUI &&
            value.unit &&
            value.unit !== '-' &&
            value.unit !== NONE_UNIT && <Tag variant="promotion">{value.unit}</Tag>}
        </Fragment>
      ),
    }),
    [metricSelectValue, value.name, value.type, value.unit, hasMetricUnitsUI]
  );

  const metricOptions = useMemo((): MetricSelectOption[] => {
    const shouldIncludeOptionFromTraceMetric =
      value.name &&
      !metricOptionsData?.data?.some(
        option => option[TraceMetricKnownFieldKey.METRIC_NAME] === value.name
      );
    return [
      ...(shouldIncludeOptionFromTraceMetric ? [optionFromTraceMetric] : []),
      ...(metricOptionsData?.data?.map(option => ({
        label: option[TraceMetricKnownFieldKey.METRIC_NAME],
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
        trailingItems: (
          <Fragment>
            <MetricTypeBadge metricType={option[TraceMetricKnownFieldKey.METRIC_TYPE]} />
            {hasMetricUnitsUI &&
              option[TraceMetricKnownFieldKey.METRIC_UNIT] &&
              option[TraceMetricKnownFieldKey.METRIC_UNIT] !== NONE_UNIT && (
                <Tag variant="promotion">
                  {option[TraceMetricKnownFieldKey.METRIC_UNIT]}
                </Tag>
              )}
          </Fragment>
        ),
      })) ?? []),
    ];
  }, [metricOptionsData, optionFromTraceMetric, value.name, hasMetricUnitsUI]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((newSearch: string) => {
      setSearch(newSearch);
    }, DEFAULT_DEBOUNCE_DURATION),
    [setSearch]
  );

  useEffect(() => {
    return () => debouncedSetSearch.cancel();
  }, [debouncedSetSearch]);

  // Auto-select the first metric when options load and none is selected yet.
  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !value.name) {
      const firstMetric = metricOptions[0];
      onChange({
        name: firstMetric.metricName,
        type: firstMetric.metricType,
        unit: hasMetricUnitsUI ? (firstMetric.metricUnit ?? NONE_UNIT) : undefined,
      });
    }
  }, [metricOptions, value.name, hasMetricUnitsUI, onChange]);

  const previousOptions = usePrevious(metricOptions ?? []);
  const hasNoMetrics = isMetricOptionsEmpty && !search;

  return (
    <Tooltip title={t('No metrics found for this project')} disabled={!hasNoMetrics}>
      <div>
        <StyledSelect
          search={{onChange: debouncedSetSearch, filter: false}}
          options={isFetching ? previousOptions : (metricOptions ?? [])}
          value={metricSelectValue}
          loading={isFetching}
          menuTitle={t('Metrics')}
          onChange={(option: SelectOption<SelectKey>) => {
            if ('metricType' in option) {
              const metricOption = option as MetricSelectOption;
              onChange({
                name: metricOption.metricName,
                type: metricOption.metricType,
                unit: hasMetricUnitsUI
                  ? (metricOption.metricUnit ?? NONE_UNIT)
                  : undefined,
              });
            }
          }}
          disabled={disabled || hasNoMetrics}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps}>
              {value.name || t('Select a metric')}
            </OverlayTrigger.Button>
          )}
        />
      </div>
    </Tooltip>
  );
}

const StyledSelect = styled(CompactSelect)`
  width: 100%;
  max-width: 425px;
  & > button {
    width: 100%;
    font-weight: normal;
  }
`;
