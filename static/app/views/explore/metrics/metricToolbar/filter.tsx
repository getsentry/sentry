import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderAI,
} from 'sentry/components/searchQueryBuilder/context';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
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
import {useValidateMetricsTab} from 'sentry/views/explore/metrics/hooks/useValidateMetricsTab';
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

const EMPTY_ALIASES: TagCollection = {};

interface FilterProps {
  traceMetric: TraceMetric;
  disableValidation?: boolean;
  disabled?: boolean;
  environments?: string[];
  portalTarget?: HTMLElement;
  projectIds?: number[];
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
  const {displayAskSeer} = useSearchQueryBuilderAI();

  if (displayAskSeer) {
    return <MetricsTabSeerComboBox traceMetric={traceMetric} />;
  }

  return <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />;
}

export function Filter({
  traceMetric,
  skipTraceMetricFilter,
  projectIds,
  environments,
  portalTarget,
  disabled,
  disableValidation,
}: FilterProps) {
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

  const {data, isLoading} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      query: attributeQuery,
      projectIds,
      environments,
    }),
    enabled: skipTraceMetricFilter || Boolean(traceMetricFilter),
    select: selectTraceItemTagCollection(),
  });
  const isSearchBarDisabled =
    isLoading || (!skipTraceMetricFilter && !traceMetricFilter) || disabled;

  const {data: validatedSearchQueryData} = useValidateMetricsTab({
    enabled:
      !disableValidation &&
      Boolean(query) &&
      (skipTraceMetricFilter || Boolean(traceMetricFilter)) &&
      !disabled,
    projectIds,
    environments,
  });

  const visibleNumberTags = useMemo(() => {
    const staticNumberTags = SENTRY_TRACEMETRIC_NUMBER_TAGS.reduce<TagCollection>(
      (acc, key) => {
        if (!HiddenTraceMetricSearchFields.includes(key)) {
          acc[key] = {key, name: key, kind: FieldKind.MEASUREMENT};
        }
        return acc;
      },
      {}
    );

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
    const staticStringTags = SENTRY_TRACEMETRIC_STRING_TAGS.reduce<TagCollection>(
      (acc, key) => {
        if (!HiddenTraceMetricSearchFields.includes(key)) {
          acc[key] = {key, name: key, kind: FieldKind.FIELD};
        }
        return acc;
      },
      {}
    );

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
    const staticBooleanTags = SENTRY_TRACEMETRIC_BOOLEAN_TAGS.reduce<TagCollection>(
      (acc, key) => {
        if (!HiddenTraceMetricSearchFields.includes(key)) {
          acc[key] = {key, name: key, kind: FieldKind.BOOLEAN};
        }
        return acc;
      },
      {}
    );

    return {
      ...staticBooleanTags,
      ...Object.fromEntries(
        Object.entries(data?.booleanAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.booleanAttributes]);

  const {
    validatedNumberTags,
    validatedStringTags,
    validatedBooleanTags,
    invalidFilterKeys,
  } = useMemo(() => {
    const localBooleanTags: TagCollection = {...visibleBooleanTags};
    const localNumberTags: TagCollection = {...visibleNumberTags};
    const localStringTags: TagCollection = {...visibleStringTags};
    const localInvalidFilterKeys: string[] = [];

    for (const item of validatedSearchQueryData?.query.fields ?? []) {
      if (HiddenTraceMetricSearchFields.includes(item.name)) {
        continue;
      }

      if (item.valid) {
        if (item.attrType === 'boolean') {
          localBooleanTags[item.name] ??= {
            key: item.name,
            name: prettifyAttributeName(item.name),
            kind: FieldKind.BOOLEAN,
          };
        }

        if (item.attrType === 'number') {
          localNumberTags[item.name] ??= {
            key: item.name,
            name: prettifyAttributeName(item.name),
            kind: FieldKind.MEASUREMENT,
          };
        }

        if (item.attrType === 'string') {
          localStringTags[item.name] ??= {
            key: item.name,
            name: prettifyAttributeName(item.name),
            kind: FieldKind.TAG,
          };
        }

        continue;
      }

      localInvalidFilterKeys.push(item.name);
    }

    return {
      validatedNumberTags: localNumberTags,
      validatedStringTags: localStringTags,
      validatedBooleanTags: localBooleanTags,
      invalidFilterKeys: localInvalidFilterKeys,
    };
  }, [
    validatedSearchQueryData?.query.fields,
    visibleBooleanTags,
    visibleNumberTags,
    visibleStringTags,
  ]);

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps =
    useMemo(() => {
      return {
        itemType: TraceItemDataset.TRACEMETRICS,
        booleanAttributes: validatedBooleanTags,
        numberAttributes: validatedNumberTags,
        stringAttributes: validatedStringTags,
        booleanSecondaryAliases: EMPTY_ALIASES,
        numberSecondaryAliases: EMPTY_ALIASES,
        stringSecondaryAliases: EMPTY_ALIASES,
        initialQuery: query,
        onSearch: setQuery,
        searchSource: 'tracemetrics',
        namespace: traceMetric.name,
        defaultToAskSeerOnFreeTextSearch: true,
        attributeQuery,
        hiddenAttributeKeys: HiddenTraceMetricSearchFields,
        projects: projectIds,
        environments,
        disabled: isSearchBarDisabled,
        portalTarget,
        invalidFilterKeys,

        // Disable the recent searches when not using a trace metric filter or when the metric name
        // is not set because the recent searches for metrics need to be namespaced on the trace metric filter.
        disableRecentSearches: skipTraceMetricFilter || !traceMetric.name,
      };
    }, [
      attributeQuery,
      environments,
      invalidFilterKeys,
      isSearchBarDisabled,
      portalTarget,
      projectIds,
      query,
      setQuery,
      skipTraceMetricFilter,
      traceMetric.name,
      validatedBooleanTags,
      validatedNumberTags,
      validatedStringTags,
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
