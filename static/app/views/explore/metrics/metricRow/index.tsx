import {useMemo} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricRow/aggregateDropdown';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricRow/groupBySelector';
import {
  useMetricVisualize,
  useSetMetricName,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface MetricRowProps {
  traceMetric: TraceMetric;
}

export function MetricRow({traceMetric}: MetricRowProps) {
  const query = useQueryParamsQuery();
  const setQuery = useSetQueryParamsQuery();

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps =
    useMemo(() => {
      return {
        itemType: TraceItemDataset.TRACEMETRICS,
        numberAttributes: {},
        stringAttributes: {},
        numberSecondaryAliases: {},
        stringSecondaryAliases: {},
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
      };
    }, [query, setQuery]);

  const searchQueryBuilderProviderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProviderProps}>
      <MetricToolbar
        tracesItemSearchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
        traceMetric={traceMetric}
      />
    </SearchQueryBuilderProvider>
  );
}
interface MetricToolbarProps {
  traceMetric: TraceMetric;
  tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
}

function MetricToolbar({
  tracesItemSearchQueryBuilderProps,
  traceMetric,
}: MetricToolbarProps) {
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const query = useQueryParamsQuery();
  const {data: metricOptionsData} = useMetricOptions();
  const setMetricName = useSetMetricName();

  const metricOptions = useMemo(() => {
    return [
      ...(metricOptionsData?.data?.map(option => ({
        label: `${option['metric.name']} (${option['metric.type']})`,
        value: option['metric.name'],
        type: option['metric.type'],
      })) ?? []),
      // TODO(nar): Remove these when we actually have metrics served
      // This is only used for providing an option to test current selection behavior
      {
        label: 'test-distribution',
        value: 'test-distribution',
        type: 'distribution' as const,
      },
      {
        label: 'test-gauge',
        value: 'test-gauge',
        type: 'gauge' as const,
      },
    ];
  }, [metricOptionsData]);

  // TODO(nar): This should come from the metric data context
  // so we can display different types with conflicting names
  const currentMetricType = useMemo(() => {
    return metricOptions?.find(metricData => metricData.value === traceMetric.name)?.type;
  }, [metricOptions, traceMetric.name]);

  return (
    <div style={{width: '100%'}}>
      {traceMetric.name}/{visualize.yAxis}/ by {groupBys.join(',')}/ where {query}
      <Flex direction="row" gap="md" align="center">
        {t('Query')}
        <CompactSelect
          options={metricOptions ?? []}
          value={traceMetric.name}
          onChange={option => {
            setMetricName(option.value);
          }}
        />
        <AggregateDropdown type={currentMetricType} />
        {t('by')}
        <GroupBySelector metricName={traceMetric.name} />
        {t('where')}
        <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
      </Flex>
    </div>
  );
}
