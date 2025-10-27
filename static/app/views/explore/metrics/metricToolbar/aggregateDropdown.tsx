import {useEffect} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';
import {
  useMetricVisualize,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';

const OPTIONS_BY_TYPE: Record<string, Array<{label: string; value: string}>> = {
  counter: [
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
  ],
};

const DEFAULT_YAXIS_BY_TYPE: Record<string, string> = {
  counter: 'sum',
  distribution: 'p75',
  gauge: 'avg',
};

export function AggregateDropdown({type}: {type: string}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const previousType = usePrevious(type);

  useEffect(() => {
    if (
      defined(previousType) &&
      previousType !== type &&
      defined(DEFAULT_YAXIS_BY_TYPE[type])
    ) {
      setVisualize(
        visualize.replace({
          yAxis: `${DEFAULT_YAXIS_BY_TYPE[type]}(${visualize.parsedFunction?.arguments?.[0] ?? ''})`,
        })
      );
    }
  }, [setVisualize, visualize, type, previousType]);

  return (
    <CompactSelect
      triggerProps={{
        prefix: t('Agg'),
      }}
      options={defined(OPTIONS_BY_TYPE[type]) ? OPTIONS_BY_TYPE[type] : []}
      value={visualize.parsedFunction?.name ?? ''}
      onChange={option => {
        setVisualize(
          visualize.replace({
            yAxis: `${option.value}(${visualize.parsedFunction?.arguments?.[0] ?? ''})`,
          })
        );
      }}
    />
  );
}
