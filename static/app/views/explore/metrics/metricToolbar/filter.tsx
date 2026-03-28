import {useMemo} from 'react';

import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
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
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsTabSeerComboBox} from 'sentry/views/explore/metrics/metricsTabSeerComboBox';
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

function MetricsSearchBar({
  tracesItemSearchQueryBuilderProps,
}: {
  tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
}) {
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    return <MetricsTabSeerComboBox />;
  }

  return <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />;
}

export function Filter({traceMetric}: FilterProps) {
  const organization = useOrganization();
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
  const {attributes: booleanTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'boolean',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
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
        Object.entries(numberTags ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [numberTags]);

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
        Object.entries(stringTags ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [stringTags]);

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
        Object.entries(booleanTags ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [booleanTags]);

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
      };
    }, [
      query,
      setQuery,
      visibleBooleanTags,
      visibleNumberTags,
      visibleStringTags,
      traceMetric.name,
    ]);

  const searchQueryBuilderProviderProps = useTraceItemSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures &&
    organization.features.includes('gen-ai-features') &&
    organization.features.includes('gen-ai-search-agent-translate');

  return (
    <SearchQueryBuilderProvider
      // Use the metric name as a key to force remount when it changes
      // This prevents race conditions when navigating between different metrics
      key={traceMetric.name}
      {...searchQueryBuilderProviderProps}
      enableAISearch={areAiFeaturesAllowed}
      aiSearchBadgeType="alpha"
    >
      <MetricsSearchBar
        tracesItemSearchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
      />
    </SearchQueryBuilderProvider>
  );
}
