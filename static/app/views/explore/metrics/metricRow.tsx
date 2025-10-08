import {useEffect, useMemo} from 'react';

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
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsGroupBys,
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import type {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface MetricRowProps {
  metricName: string;
  setMetricName: (metricName: string) => void;
  traceMetric: TraceMetric;
}

export function MetricRow({traceMetric, metricName, setMetricName}: MetricRowProps) {
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
        metricName={metricName}
        setMetricName={setMetricName}
        tracesItemSearchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
        traceMetric={traceMetric}
      />
    </SearchQueryBuilderProvider>
  );
}

interface MetricToolbarProps {
  metricName: string;
  setMetricName: (metricName: string) => void;
  traceMetric: TraceMetric;
  tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
}

function MetricToolbar({
  tracesItemSearchQueryBuilderProps,
  traceMetric,
  setMetricName,
  metricName,
}: MetricToolbarProps) {
  const visualize = useMetricVisualize() as VisualizeFunction;
  const groupBys = useQueryParamsGroupBys();
  const query = useQueryParamsQuery();
  const {data: metricOptions} = useMetricOptions();

  useEffect(() => {
    if (!metricName) {
      setMetricName(metricOptions?.data?.[0]?.metric_name ?? '');
    }
  }, [metricName, metricOptions, setMetricName]);

  return (
    <div style={{width: '100%'}}>
      {traceMetric.name}/{visualize.yAxis}/ by {groupBys.join(',')}/ where {query}
      <Flex direction="row" gap="md" align="center">
        {t('Query')}
        <CompactSelect
          options={
            metricOptions?.data?.map(option => ({
              label: `${option.metric_name} (${option.metric_type})`,
              value: option.metric_name,
            })) ?? []
          }
          value={metricName}
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
