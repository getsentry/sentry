import {useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  TraceItemSearchQueryBuilder,
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  SENTRY_TRACEMETRIC_BOOLEAN_TAGS,
  SENTRY_TRACEMETRIC_NUMBER_TAGS,
  SENTRY_TRACEMETRIC_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsTabSeerComboBox} from 'sentry/views/explore/metrics/metricsTabSeerComboBox';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  selectTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

const EMPTY_TAG_COLLECTION: TagCollection = {};
const EMPTY_ALIASES: TagCollection = {};

interface FilterProps {
  traceMetric: TraceMetric;
  skipTraceMetricFilter?: boolean;
}

interface MetricsSearchBarProps {
  traceMetric: TraceMetric;
  tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
}

function MetricsSearchBar({
  tracesItemSearchQueryBuilderProps,
  traceMetric,
}: MetricsSearchBarProps) {
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    return <MetricsTabSeerComboBox traceMetric={traceMetric} />;
  }

  return <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />;
}

export function Filter({traceMetric, skipTraceMetricFilter}: FilterProps) {
  const query = useQueryParamsQuery();
  const setQuery = useSetQueryParamsQuery();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const hasTranslateEndpoint = organization.features.includes(
    'gen-ai-search-agent-translate'
  );
  const hasMetricsAISearch = organization.features.includes(
    'gen-ai-explore-metrics-search'
  );

  const traceMetricFilter = createTraceMetricFilter(traceMetric);
  const attributeQuery = skipTraceMetricFilter ? undefined : traceMetricFilter;

  const {data: data} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      query: attributeQuery,
    }),
    enabled: skipTraceMetricFilter || Boolean(traceMetricFilter),
    select: selectTraceItemTagCollection(),
  });

  const visibleNumberTags = useMemo(() => {
    const staticNumberTags = SENTRY_TRACEMETRIC_NUMBER_TAGS.reduce((acc, key) => {
      if (!HiddenTraceMetricSearchFields.includes(key)) {
        acc[key] = {key, name: key, kind: FieldKind.MEASUREMENT};
      }
      return acc;
    }, {} as TagCollection);

    return {
      ...staticNumberTags,
      ...Object.fromEntries(
        Object.entries(data?.numberAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.numberAttributes]);

  const visibleStringTags = useMemo(() => {
    const staticStringTags = SENTRY_TRACEMETRIC_STRING_TAGS.reduce((acc, key) => {
      if (!HiddenTraceMetricSearchFields.includes(key)) {
        acc[key] = {key, name: key, kind: FieldKind.FIELD};
      }
      return acc;
    }, {} as TagCollection);

    return {
      ...staticStringTags,
      ...Object.fromEntries(
        Object.entries(data?.stringAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.stringAttributes]);

  const visibleBooleanTags = useMemo(() => {
    const staticBooleanTags = SENTRY_TRACEMETRIC_BOOLEAN_TAGS.reduce((acc, key) => {
      if (!HiddenTraceMetricSearchFields.includes(key)) {
        acc[key] = {key, name: key, kind: FieldKind.BOOLEAN};
      }
      return acc;
    }, {} as TagCollection);

    return {
      ...staticBooleanTags,
      ...Object.fromEntries(
        Object.entries(data?.booleanAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.booleanAttributes]);

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps =
    useMemo(() => {
      return {
        itemType: TraceItemDataset.TRACEMETRICS,
        booleanAttributes: visibleBooleanTags ?? EMPTY_TAG_COLLECTION,
        numberAttributes: visibleNumberTags ?? EMPTY_TAG_COLLECTION,
        stringAttributes: visibleStringTags ?? EMPTY_TAG_COLLECTION,
        booleanSecondaryAliases: EMPTY_ALIASES,
        numberSecondaryAliases: EMPTY_ALIASES,
        stringSecondaryAliases: EMPTY_ALIASES,
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
        namespace: traceMetric.name,
        attributeQuery,
        hiddenAttributeKeys: HiddenTraceMetricSearchFields,

        // Disable the recent searches when not using a trace metric filter or when the metric name
        // is not set because the recent searches for metrics need to be namespaced on the trace metric filter.
        disableRecentSearches: skipTraceMetricFilter || !traceMetric.name,
      };
    }, [
      query,
      setQuery,
      visibleBooleanTags,
      visibleNumberTags,
      visibleStringTags,
      traceMetric.name,
      attributeQuery,
      skipTraceMetricFilter,
    ]);

  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return (
    <SearchQueryBuilderProvider
      // Use the metric name as a key to force remount when it changes
      // This prevents race conditions when navigating between different metrics
      key={traceMetric.name}
      {...searchQueryBuilderProviderProps}
      enableAISearch={hasTranslateEndpoint && hasMetricsAISearch}
      aiSearchBadgeType="alpha"
    >
      <MetricsSearchBar
        tracesItemSearchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
        traceMetric={traceMetric}
      />
    </SearchQueryBuilderProvider>
  );
}
