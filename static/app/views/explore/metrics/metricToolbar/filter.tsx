import {useMemo} from 'react';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createMetricNameFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

const EMPTY_TAG_COLLECTION: TagCollection = {};
const EMPTY_ALIASES: TagCollection = {};

interface FilterProps {
  traceMetric: TraceMetric;
}

export function Filter({traceMetric}: FilterProps) {
  const query = useQueryParamsQuery();
  const setQuery = useSetQueryParamsQuery();

  const metricNameFilter = createMetricNameFilter(traceMetric.name);

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
        numberAttributes: numberTags ?? EMPTY_TAG_COLLECTION,
        stringAttributes: stringTags ?? EMPTY_TAG_COLLECTION,
        numberSecondaryAliases: EMPTY_ALIASES,
        stringSecondaryAliases: EMPTY_ALIASES,
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
        namespace: traceMetric.name,
      };
    }, [query, setQuery, numberTags, stringTags, traceMetric.name]);

  const searchQueryBuilderProviderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider
      // Use the metric name as a key to force remount when it changes
      // This prevents race conditions when navigating between different metrics
      key={traceMetric.name}
      {...searchQueryBuilderProviderProps}
    >
      <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
    </SearchQueryBuilderProvider>
  );
}
