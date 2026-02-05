import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import usePrevious from 'sentry/utils/usePrevious';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';
import {makeMetricsAggregate} from 'sentry/views/explore/metrics/utils';

interface Props {
  aggregate: string;
  onChange: (value: string, meta: Record<string, any>) => void;
  environment?: string | null;
  onLoadingChange?: (isLoading: boolean) => void;
  projectId?: string;
}

interface MetricSelectOption {
  label: string;
  metricName: string;
  metricType: TraceMetricTypeValue;
  trailingItems: ReactNode;
  value: string;
}

function makeMetricSelectValue(metric: TraceMetric): string {
  return `${metric.name}||${metric.type}`;
}

export default function EAPMetricsField({
  aggregate,
  onChange,
  onLoadingChange,
  projectId,
  environment,
}: Props) {
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

  useEffect(() => {
    onLoadingChange?.(isFetching);
  }, [isFetching, onLoadingChange]);

  const {aggregation, traceMetric} = parseMetricAggregate(aggregate);

  const metricSelectValue = makeMetricSelectValue(traceMetric);
  const optionFromTraceMetric: MetricSelectOption = useMemo(
    () => ({
      label: traceMetric.name || t('Select a metric'),
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setSearch(newSearch);
    }, DEFAULT_DEBOUNCE_DURATION),
    [setSearch]
  );

  const operationOptions = useMemo(() => {
    const metricType = traceMetric.type?.toLowerCase() ?? '';
    return OPTIONS_BY_TYPE[metricType] ?? OPTIONS_BY_TYPE.distribution ?? [];
  }, [traceMetric.type]);

  const handleOperationChange = useCallback(
    (option: {value: string}) => {
      const newAggregate = makeMetricsAggregate({
        aggregate: option.value,
        traceMetric,
      });
      onChange(newAggregate, {});
    },
    [onChange, traceMetric]
  );

  const handleMetricChange = useCallback(
    (option: MetricSelectOption) => {
      const newMetric: TraceMetric = {
        name: option.metricName,
        type: option.metricType,
      };
      const newMetricType = option.metricType?.toLowerCase() ?? '';
      const validOperations = OPTIONS_BY_TYPE[newMetricType] ?? [];

      // Always reset to first available operation for the new metric type
      const newAggregation = validOperations[0]?.value ?? 'avg';

      const newAggregate = makeMetricsAggregate({
        aggregate: newAggregation,
        traceMetric: newMetric,
      });
      onChange(newAggregate, {});
    },
    [onChange]
  );

  const traceMetricSelectValue = makeMetricSelectValue(traceMetric);
  const previousOptions = usePrevious(metricOptions ?? []);

  // Auto-select the first metric when API resolves and no metric is selected
  useEffect(() => {
    if (metricOptions.length && metricOptions[0] && !traceMetric.name) {
      const firstMetric = metricOptions[0];
      const metricType = firstMetric.metricType?.toLowerCase() ?? '';
      const validOperations = OPTIONS_BY_TYPE[metricType] ?? [];
      const firstOperation = validOperations[0]?.value ?? 'avg';

      const newAggregate = makeMetricsAggregate({
        aggregate: firstOperation,
        traceMetric: {name: firstMetric.metricName, type: firstMetric.metricType},
      });
      onChange(newAggregate, {});
    }
  }, [metricOptions, onChange, traceMetric.name]);

  const hasNoMetrics = isMetricOptionsEmpty && !search;

  return (
    <Flex gap="md">
      <FlexWrapper>
        <StyledSelectControl
          searchable
          options={isFetching ? previousOptions : (metricOptions ?? [])}
          value={traceMetricSelectValue}
          loading={isFetching}
          onSearch={debouncedSetSearch}
          placeholder={t('Select a metric')}
          noOptionsMessage={() => t('No metrics found')}
          onChange={(option: MetricSelectOption) => handleMetricChange(option)}
          disabled={hasNoMetrics}
        />
      </FlexWrapper>
      <StyledSelectControl
        searchable
        placeholder={t('Select an operation')}
        options={operationOptions}
        value={aggregation}
        onChange={handleOperationChange}
        disabled={hasNoMetrics || !traceMetric.name}
      />
    </Flex>
  );
}

const FlexWrapper = styled('div')`
  flex: 1;
`;

const StyledSelectControl = styled(Select)`
  width: 200px;
`;
