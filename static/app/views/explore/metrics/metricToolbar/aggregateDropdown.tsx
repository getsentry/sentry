import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
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

export function AggregateDropdown({type}: {type: string | undefined}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();

  return (
    <CompactSelect
      triggerProps={{
        prefix: t('Agg'),
      }}
      options={
        defined(type) && defined(OPTIONS_BY_TYPE[type]) ? OPTIONS_BY_TYPE[type] : []
      }
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
