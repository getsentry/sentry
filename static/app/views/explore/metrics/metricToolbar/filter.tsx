import {useMemo} from 'react';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
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

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
  });

  const visibleNumberTags = useMemo(() => {
    return Object.fromEntries(
      Object.entries(numberTags ?? {}).filter(
        ([key]) => !HiddenTraceMetricSearchFields.includes(key)
      )
    );
  }, [numberTags]);

  const visibleStringTags = useMemo(() => {
    return Object.fromEntries(
      Object.entries(stringTags ?? {}).filter(
        ([key]) => !HiddenTraceMetricSearchFields.includes(key)
      )
    );
  }, [stringTags]);

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps =
    useMemo(() => {
      return {
        itemType: TraceItemDataset.TRACEMETRICS,
        numberAttributes: visibleNumberTags ?? EMPTY_TAG_COLLECTION,
        stringAttributes: visibleStringTags ?? EMPTY_TAG_COLLECTION,
        numberSecondaryAliases: EMPTY_ALIASES,
        stringSecondaryAliases: EMPTY_ALIASES,
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
        namespace: traceMetric.name,
      };
    }, [query, setQuery, visibleNumberTags, visibleStringTags, traceMetric.name]);

  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps(
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
