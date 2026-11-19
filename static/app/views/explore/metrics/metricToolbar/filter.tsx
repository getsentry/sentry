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
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

const EMPTY_ALIASES: TagCollection = {};

interface MetricFilterBarProps {
  onSearch: (query: string) => void;
  query: string;
  traceMetric: TraceMetric;
  disabled?: boolean;
  /**
   * Ask Seer needs the Explore query params context, so leave this off when
   * the bar is controlled from elsewhere.
   */
  enableAISearch?: boolean;
  environments?: string[];
  portalTarget?: HTMLElement;
  projectIds?: number[];
  skipTraceMetricFilter?: boolean;
  /**
   * Attribute validation results used to flag unknown filter keys.
   */
  validatedFields?: EventValidationData['query']['fields'];
}

interface FilterProps extends Omit<
  MetricFilterBarProps,
  'enableAISearch' | 'onSearch' | 'query' | 'validatedFields'
> {
  disableValidation?: boolean;
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

/**
 * Per-metric search bar that reads and writes the query through the Explore
 * query params context.
 */
export function Filter({disableValidation, ...props}: FilterProps) {
  const {traceMetric, skipTraceMetricFilter, projectIds, environments, disabled} = props;
  const query = useQueryParamsQuery();
  const setQuery = useSetQueryParamsQuery();

  const {data: validatedSearchQueryData} = useValidateMetricsTab({
    enabled:
      !disableValidation &&
      Boolean(query) &&
      (skipTraceMetricFilter || Boolean(createTraceMetricFilter(traceMetric))) &&
      !disabled,
    projectIds,
    environments,
  });

  return (
    <MetricFilterBar
      {...props}
      query={query}
      onSearch={setQuery}
      validatedFields={validatedSearchQueryData?.query.fields}
      enableAISearch
    />
  );
}

/**
 * Per-metric search bar whose query is controlled by the caller. Attribute
 * suggestions are scoped to the metric unless `skipTraceMetricFilter` is set.
 */
export function MetricFilterBar({
  traceMetric,
  query,
  onSearch,
  skipTraceMetricFilter,
  projectIds,
  environments,
  portalTarget,
  disabled,
  enableAISearch = false,
  validatedFields,
}: MetricFilterBarProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const supportsArrays = organization.features.includes('trace-item-array-query-support');

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

  const visibleArrayTags = useMemo(() => {
    if (!supportsArrays) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(data?.arrayAttributes ?? {}).filter(
        ([key]) => !HiddenTraceMetricSearchFields.includes(key)
      )
    );
  }, [data?.arrayAttributes, supportsArrays]);

  const {
    validatedArrayTags,
    validatedNumberTags,
    validatedStringTags,
    validatedBooleanTags,
    invalidFilterKeys,
  } = useMemo(() => {
    const localArrayTags: TagCollection = {...visibleArrayTags};
    const localBooleanTags: TagCollection = {...visibleBooleanTags};
    const localNumberTags: TagCollection = {...visibleNumberTags};
    const localStringTags: TagCollection = {...visibleStringTags};
    const localInvalidFilterKeys: string[] = [];

    for (const item of validatedFields ?? []) {
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

        if (supportsArrays && item.attrType === 'array') {
          localArrayTags[item.name] ??= {
            key: item.name,
            name: prettifyAttributeName(item.name),
            kind: FieldKind.ARRAY,
          };
        }

        continue;
      }

      localInvalidFilterKeys.push(item.name);
    }

    return {
      validatedArrayTags: localArrayTags,
      validatedNumberTags: localNumberTags,
      validatedStringTags: localStringTags,
      validatedBooleanTags: localBooleanTags,
      invalidFilterKeys: localInvalidFilterKeys,
    };
  }, [
    supportsArrays,
    validatedFields,
    visibleArrayTags,
    visibleBooleanTags,
    visibleNumberTags,
    visibleStringTags,
  ]);

  const tracesItemSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps =
    useMemo(() => {
      return {
        itemType: TraceItemDataset.TRACEMETRICS,
        arrayAttributes: validatedArrayTags,
        booleanAttributes: validatedBooleanTags,
        numberAttributes: validatedNumberTags,
        stringAttributes: validatedStringTags,
        arraySecondaryAliases: EMPTY_ALIASES,
        booleanSecondaryAliases: EMPTY_ALIASES,
        numberSecondaryAliases: EMPTY_ALIASES,
        stringSecondaryAliases: EMPTY_ALIASES,
        initialQuery: query,
        onSearch,
        searchSource: 'tracemetrics',
        namespace: traceMetric.name,
        defaultToAskSeerOnFreeTextSearch: enableAISearch,
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
      enableAISearch,
      environments,
      invalidFilterKeys,
      isSearchBarDisabled,
      onSearch,
      portalTarget,
      projectIds,
      query,
      skipTraceMetricFilter,
      traceMetric.name,
      validatedArrayTags,
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
      enableAISearch={enableAISearch}
    >
      <MetricsSearchBar
        tracesItemSearchQueryBuilderProps={tracesItemSearchQueryBuilderProps}
        traceMetric={traceMetric}
      />
    </SearchQueryBuilderProvider>
  );
}
