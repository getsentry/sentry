import {useMemo} from 'react';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
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
        numberAttributes: numberTags ?? EMPTY_TAG_COLLECTION,
        stringAttributes: stringTags ?? EMPTY_TAG_COLLECTION,
        numberSecondaryAliases: EMPTY_ALIASES,
        stringSecondaryAliases: EMPTY_ALIASES,
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
      };
    }, [query, setQuery, numberTags, stringTags]);

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
