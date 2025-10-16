import {useEffect, useMemo} from 'react';

import {Tag} from '@sentry/scraps/badge/tag';
import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';

import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useSetTraceMetric} from 'sentry/views/explore/metrics/metricsQueryParams';

interface MetricSelectOption extends SelectOption<string> {
  type: string;
}

function TypeBadge({kind}: {kind: string}) {
  if (!kind) {
    return null;
  }

  return <Tag>{kind}</Tag>;
}

export function MetricSelector({traceMetric}: {traceMetric: TraceMetric}) {
  const {data: metricOptionsData} = useMetricOptions();
  const setTraceMetric = useSetTraceMetric();

  const metricOptions = useMemo((): MetricSelectOption[] => {
    return [
      ...(metricOptionsData?.data?.map(option => ({
        label: `${option['metric.name']}`,
        value: option['metric.name'],
        type: option['metric.type'],
        trailingItems: <TypeBadge kind={option['metric.type']} />,
      })) ?? []),
    ];
  }, [metricOptionsData]);

  useEffect(() => {
    if (metricOptions.length && !traceMetric.name) {
      setTraceMetric({
        name: metricOptions[0]?.value ?? '',
        type: metricOptions[0]?.type ?? '',
      });
    }
  }, [metricOptions, setTraceMetric, traceMetric.name]);

  return (
    <CompactSelect
      searchable
      options={metricOptions ?? []}
      value={traceMetric.name}
      onChange={option => {
        if ('type' in option) {
          const typedOption = option as MetricSelectOption;
          setTraceMetric({
            name: typedOption.value,
            type: typedOption.type,
          });
        }
      }}
    />
  );
}
