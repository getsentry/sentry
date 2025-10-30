import {useEffect} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';

const OPTIONS_BY_TYPE: Record<string, Array<{label: string; value: string}>> = {
  counter: [
    {
      label: 'per_second',
      value: 'per_second',
    },
    {
      label: 'per_minute',
      value: 'per_minute',
    },
    {
      label: 'sum',
      value: 'sum',
    },
  ],
  distribution: [
    {
      label: 'p50',
      value: 'p50',
    },
    {
      label: 'p75',
      value: 'p75',
    },
    {
      label: 'p90',
      value: 'p90',
    },
    {
      label: 'p95',
      value: 'p95',
    },
    {
      label: 'p99',
      value: 'p99',
    },
    {
      label: 'avg',
      value: 'avg',
    },
    {
      label: 'min',
      value: 'min',
    },
    {
      label: 'max',
      value: 'max',
    },
    {
      label: 'sum',
      value: 'sum',
    },
    {
      label: 'count',
      value: 'count',
    },
    {
      label: 'per_second',
      value: 'per_second',
    },
    {
      label: 'per_minute',
      value: 'per_minute',
    },
  ],
  gauge: [
    {
      label: 'min',
      value: 'min',
    },
    {
      label: 'max',
      value: 'max',
    },
    {
      label: 'avg',
      value: 'avg',
    },
    {
      label: 'last',
      value: 'last',
    },
    {
      label: 'per_second',
      value: 'per_second',
    },
    {
      label: 'per_minute',
      value: 'per_minute',
    },
  ],
};

const DEFAULT_YAXIS_BY_TYPE: Record<string, string> = {
  counter: 'per_second',
  distribution: 'p75',
  gauge: 'avg',
};

function getFunctionArguments(functionName: string, traceMetric: TraceMetric): string {
  if (functionName === 'per_second' || functionName === 'per_minute') {
    return `${traceMetric.name}, ${traceMetric.type}`;
  }
  return 'value';
}

export function AggregateDropdown({traceMetric}: {traceMetric: TraceMetric}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const previousType = usePrevious(traceMetric.type);

  useEffect(() => {
    if (
      defined(previousType) &&
      previousType !== traceMetric.type &&
      defined(DEFAULT_YAXIS_BY_TYPE[traceMetric.type])
    ) {
      const defaultFunction = DEFAULT_YAXIS_BY_TYPE[traceMetric.type];
      if (defaultFunction) {
        const functionArgs = getFunctionArguments(defaultFunction, traceMetric);
        setVisualize(
          visualize.replace({
            yAxis: `${defaultFunction}(${functionArgs})`,
            chartType: undefined, // Reset chart type to let determineDefaultChartType decide
          })
        );
      }
    }
  }, [setVisualize, visualize, traceMetric.type, previousType, traceMetric]);

  return (
    <CompactSelect
      triggerProps={{
        prefix: t('Agg'),
      }}
      options={OPTIONS_BY_TYPE[traceMetric.type] ?? []}
      value={visualize.parsedFunction?.name ?? ''}
      onChange={option => {
        const functionArgs = getFunctionArguments(option.value, traceMetric);
        setVisualize(
          visualize.replace({
            yAxis: `${option.value}(${functionArgs})`,
            chartType: undefined, // Reset chart type to let determineDefaultChartType decide
          })
        );
      }}
    />
  );
}
