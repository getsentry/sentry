import {useMemo} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricRow/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricRow/deleteMetricButton';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricRow/groupBySelector';
import {MetricSelector} from 'sentry/views/explore/metrics/metricRow/metricSelector';
import {
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

  const metricNameFilter = traceMetric.name
    ? MutableSearch.fromQueryObject({['metric.name']: [traceMetric.name]}).formatString()
    : undefined;

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(metricNameFilter),
    query: metricNameFilter,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(metricNameFilter),
    query: metricNameFilter,
  });

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps =
    useMemo(() => {
      return {
        itemType: TraceItemDataset.TRACEMETRICS,
        numberAttributes: numberTags ?? {},
        stringAttributes: stringTags ?? {},
        numberSecondaryAliases: {},
        stringSecondaryAliases: {},
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
      };
    }, [query, setQuery, numberTags, stringTags]);

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
  return (
    <div style={{width: '100%'}}>
      <Flex direction="row" gap="md" align="center">
        {t('Query')}
        <MetricSelector traceMetric={traceMetric} />
        <AggregateDropdown type={traceMetric.type} />
        {t('by')}
        <GroupBySelector metricName={traceMetric.name} />
        {t('where')}
        <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
        <DeleteMetricButton />
      </Flex>
    </div>
  );
}
