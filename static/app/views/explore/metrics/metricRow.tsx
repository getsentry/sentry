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
import {
  useMetricVisualize,
  useSetMetricName,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import type {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
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
  const visualize = useMetricVisualize() as VisualizeFunction;
  const groupBys = useQueryParamsGroupBys();
  const query = useQueryParamsQuery();
  const {data: metricOptionsData} = useMetricOptions();
  const setMetricName = useSetMetricName();

  const metricOptions = useMemo(() => {
    return [
      ...(metricOptionsData?.data?.map(option => ({
        label: `${option['metric.name']} (${option['metric.type']})`,
        value: option['metric.name'],
      })) ?? []),
      // TODO(nar): Remove these when we actually have metrics served
      // This is only used for providing an option to test current selection behavior
      {
        label: 'test-metric',
        value: 'test-metric',
      },
      {
        label: 'mock-metric',
        value: 'mock-metric',
      },
    ];
  }, [metricOptionsData]);

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
        <CompactSelect
          options={[
            {
              label: 'count',
              value: 'count',
            },
          ]}
          value={visualize.parsedFunction?.name}
        />
        {t('by')}
        <CompactSelect options={[]} value={groupBys[0] ?? ''} />
        {t('where')}
        <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
      </Flex>
    </div>
  );
}
