import {useMemo} from 'react';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {type TraceMetric} from 'sentry/views/explore/metrics/traceMetric';
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
        searchSource: 'ourmetrics',
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
  return (
    <div>
      {traceMetric.name}/{visualize.yAxis}/ by {groupBys.join(',')}/ where {query}
      <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
    </div>
  );
}
