import {useMemo} from 'react';

import type {SpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  SearchQueryBuilder,
  type SearchQueryBuilderProps,
} from 'sentry/components/searchQueryBuilder';
import type {CaseInsensitive} from 'sentry/components/searchQueryBuilder/hooks';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import type {AggregationKey} from 'sentry/utils/fields';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {getHasTag} from 'sentry/utils/tag';
import {useExploreSuggestedAttribute} from 'sentry/views/explore/hooks/useExploreSuggestedAttribute';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {LOGS_FILTER_KEY_SECTIONS} from 'sentry/views/explore/logs/constants';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

export type TraceItemSearchQueryBuilderProps = {
  itemType: TraceItemDataset;
  numberAttributes: TagCollection;
  numberSecondaryAliases: TagCollection;
  stringAttributes: TagCollection;
  stringSecondaryAliases: TagCollection;
  caseInsensitive?: CaseInsensitive;
  disabled?: boolean;
  matchKeySuggestions?: Array<{key: string; valuePattern: RegExp}>;
  namespace?: string;
  onCaseInsensitiveClick?: SearchQueryBuilderProps['onCaseInsensitiveClick'];
  replaceRawSearchKeys?: string[];
} & Omit<SpanSearchQueryBuilderProps, 'numberTags' | 'stringTags'>;

const getFunctionTags = (supportedAggregates?: AggregationKey[]) => {
  if (!supportedAggregates?.length) {
    return {};
  }

  return supportedAggregates.reduce((acc, item) => {
    acc[item] = {
      key: item,
      name: item,
      kind: FieldKind.FUNCTION,
    };
    return acc;
  }, {} as TagCollection);
};

const typeMap: Record<
  TraceItemDataset,
  'span' | 'log' | 'uptime' | 'tracemetric' | undefined
> = {
  [TraceItemDataset.SPANS]: 'span',
  [TraceItemDataset.LOGS]: 'log',
  [TraceItemDataset.UPTIME_RESULTS]: 'uptime',
  [TraceItemDataset.TRACEMETRICS]: 'tracemetric',
  [TraceItemDataset.PREPROD]: undefined,
};

function getTraceItemFieldDefinitionFunction(
  itemType: TraceItemDataset,
  tags: TagCollection
) {
  return (key: string) => {
    return getFieldDefinition(key, typeMap[itemType], tags[key]?.kind);
  };
}

export function useTraceItemSearchQueryBuilderProps({
  itemType,
  numberAttributes,
  numberSecondaryAliases,
  stringAttributes,
  stringSecondaryAliases,
  initialQuery,
  searchSource,
  getFilterTokenWarning,
  onBlur,
  onChange,
  onSearch,
  portalTarget,
  projects,
  supportedAggregates = [],
  namespace,
  replaceRawSearchKeys,
  matchKeySuggestions,
  caseInsensitive,
  onCaseInsensitiveClick,
}: TraceItemSearchQueryBuilderProps) {
  const placeholderText = itemTypeToDefaultPlaceholder(itemType);
  const functionTags = useFunctionTags(itemType, supportedAggregates);
  const filterKeySections = useFilterKeySections(itemType, stringAttributes);
  const filterTags = useFilterTags(numberAttributes, stringAttributes, functionTags);

  const getTraceItemAttributeValues = useGetTraceItemAttributeValues({
    traceItemType: itemType,
    type: 'string',
    projectIds: projects,
  });

  const getSuggestedAttribute = useExploreSuggestedAttribute({
    numberAttributes,
    stringAttributes,
  });

  return useMemo(
    () => ({
      placeholder: placeholderText,
      filterKeys: filterTags,
      initialQuery,
      fieldDefinitionGetter: getTraceItemFieldDefinitionFunction(itemType, filterTags),
      onSearch,
      onChange,
      onBlur,
      getFilterTokenWarning,
      searchSource,
      filterKeySections,
      getSuggestedFilterKey: getSuggestedAttribute,
      getTagValues: getTraceItemAttributeValues,
      disallowUnsupportedFilters: true,
      recentSearches: itemTypeToRecentSearches(itemType),
      namespace,
      showUnsubmittedIndicator: true,
      portalTarget,
      replaceRawSearchKeys,
      matchKeySuggestions,
      filterKeyAliases: {...numberSecondaryAliases, ...stringSecondaryAliases},
      caseInsensitive,
      onCaseInsensitiveClick,
    }),
    [
      caseInsensitive,
      filterKeySections,
      filterTags,
      getFilterTokenWarning,
      getSuggestedAttribute,
      getTraceItemAttributeValues,
      initialQuery,
      itemType,
      matchKeySuggestions,
      namespace,
      numberSecondaryAliases,
      onBlur,
      onCaseInsensitiveClick,
      onChange,
      onSearch,
      placeholderText,
      portalTarget,
      replaceRawSearchKeys,
      searchSource,
      stringSecondaryAliases,
    ]
  );
}

export function TraceItemSearchQueryBuilder({
  autoFocus,
  initialQuery,
  numberSecondaryAliases,
  numberAttributes,
  stringSecondaryAliases,
  searchSource,
  stringAttributes,
  itemType,
  datetime: _datetime,
  getFilterTokenWarning,
  onBlur,
  onChange,
  onSearch,
  portalTarget,
  projects,
  supportedAggregates = [],
  disabled,
  namespace,
  caseInsensitive,
  onCaseInsensitiveClick,
  matchKeySuggestions,
  replaceRawSearchKeys,
}: TraceItemSearchQueryBuilderProps) {
  const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps({
    itemType,
    numberAttributes,
    stringAttributes,
    numberSecondaryAliases,
    stringSecondaryAliases,
    initialQuery,
    searchSource,
    getFilterTokenWarning,
    onBlur,
    onChange,
    onSearch,
    portalTarget,
    projects,
    supportedAggregates,
    namespace,
    caseInsensitive,
    onCaseInsensitiveClick,
    matchKeySuggestions,
    replaceRawSearchKeys,
  });

  return (
    <SearchQueryBuilder
      autoFocus={autoFocus}
      disabled={disabled}
      {...searchQueryBuilderProps}
    />
  );
}

function useFunctionTags(
  itemType: TraceItemDataset,
  supportedAggregates?: AggregationKey[]
) {
  return useMemo(() => {
    if (itemType === TraceItemDataset.SPANS) {
      return getFunctionTags(supportedAggregates);
    }
    return {};
  }, [itemType, supportedAggregates]);
}

function useFilterTags(
  numberAttributes: TagCollection,
  stringAttributes: TagCollection,
  functionTags: TagCollection
) {
  return useMemo(() => {
    const tags: TagCollection = {
      ...functionTags,
      ...numberAttributes,
      ...stringAttributes,
    };
    tags.has = getHasTag({
      ...numberAttributes,
      ...stringAttributes,
    });
    return tags;
  }, [numberAttributes, stringAttributes, functionTags]);
}

function useFilterKeySections(
  itemType: TraceItemDataset,
  stringAttributes: TagCollection
) {
  return useMemo(() => {
    const predefined = new Set(
      itemTypeToFilterKeySections(itemType).flatMap(section => section.children)
    );
    return [
      ...itemTypeToFilterKeySections(itemType).map(section => {
        return {
          ...section,
          children: section.children.filter(key => key in stringAttributes),
        };
      }),
      {
        value: 'custom_fields',
        label: t('Attributes'),
        children: Object.keys(stringAttributes).filter(key => !predefined.has(key)),
      },
    ].filter(section => section.children.length);
  }, [stringAttributes, itemType]);
}

function itemTypeToRecentSearches(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SavedSearchType.SPAN;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SavedSearchType.TRACEMETRIC;
  }
  return SavedSearchType.LOG;
}

function itemTypeToFilterKeySections(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SPANS_FILTER_KEY_SECTIONS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return [];
  }
  return LOGS_FILTER_KEY_SECTIONS;
}

function itemTypeToDefaultPlaceholder(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return t('Search for spans, users, tags, and more');
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return t('Search for metrics, users, tags, and more');
  }
  return t('Search for logs, users, tags, and more');
}
