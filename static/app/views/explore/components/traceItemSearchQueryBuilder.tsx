import {useCallback, useMemo} from 'react';

import {getHasTag} from 'sentry/components/events/searchBar';
import type {EAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {t} from 'sentry/locale';
import {SavedSearchType, type TagCollection} from 'sentry/types/group';
import type {AggregationKey} from 'sentry/utils/fields';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {LOGS_FILTER_KEY_SECTIONS} from 'sentry/views/explore/logs/constants';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

type TraceItemSearchQueryBuilderProps = {
  itemType: TraceItemDataset;
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
  replaceRawSearchKeys?: string[];
} & Omit<EAPSpanSearchQueryBuilderProps, 'numberTags' | 'stringTags'>;

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

const typeMap: Record<TraceItemDataset, 'span' | 'log'> = {
  [TraceItemDataset.SPANS]: 'span',
  [TraceItemDataset.LOGS]: 'log',
};

function getTraceItemFieldDefinitionFunction(
  itemType: TraceItemDataset,
  tags: TagCollection
) {
  return (key: string) => {
    return getFieldDefinition(key, typeMap[itemType], tags[key]?.kind);
  };
}

export function useSearchQueryBuilderProps({
  itemType,
  numberAttributes,
  stringAttributes,
  initialQuery,
  searchSource,
  getFilterTokenWarning,
  onBlur,
  onChange,
  onSearch,
  portalTarget,
  projects,
  supportedAggregates = [],
  replaceRawSearchKeys,
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

  const getSuggestedFilterKey = useCallback(
    (key: string) => {
      // prioritize exact matches first
      if (filterTags.hasOwnProperty(key)) {
        return key;
      }

      // try to see if there's numeric attribute by the same name
      const explicitNumberTag = `tags[${key},number]`;
      if (filterTags.hasOwnProperty(explicitNumberTag)) {
        return explicitNumberTag;
      }

      // give up, and fall back to the default behaviour
      return null;
    },
    [filterTags]
  );

  return {
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
    getSuggestedFilterKey,
    getTagValues: getTraceItemAttributeValues,
    disallowUnsupportedFilters: true,
    recentSearches: itemTypeToRecentSearches(itemType),
    showUnsubmittedIndicator: true,
    portalTarget,
    replaceRawSearchKeys,
  };
}

/**
 * This component should replace EAPSpansSearchQueryBuilder in the future,
 * once spans support has been added to the trace-items attribute endpoints.
 */
export function TraceItemSearchQueryBuilder({
  autoFocus,
  initialQuery,
  numberAttributes,
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
}: TraceItemSearchQueryBuilderProps) {
  const searchQueryBuilderProps = useSearchQueryBuilderProps({
    itemType,
    numberAttributes,
    stringAttributes,
    initialQuery,
    searchSource,
    getFilterTokenWarning,
    onBlur,
    onChange,
    onSearch,
    portalTarget,
    projects,
    supportedAggregates,
  });

  return <SearchQueryBuilder autoFocus={autoFocus} {...searchQueryBuilderProps} />;
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
          children: section.children.filter(key => stringAttributes.hasOwnProperty(key)),
        };
      }),
      {
        value: 'custom_fields',
        label: 'Custom Tags',
        children: Object.keys(stringAttributes).filter(key => !predefined.has(key)),
      },
    ].filter(section => section.children.length);
  }, [stringAttributes, itemType]);
}

function itemTypeToRecentSearches(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SavedSearchType.SPAN;
  }
  return SavedSearchType.LOG;
}

function itemTypeToFilterKeySections(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SPANS_FILTER_KEY_SECTIONS;
  }
  return LOGS_FILTER_KEY_SECTIONS;
}

function itemTypeToDefaultPlaceholder(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return t('Search for spans, users, tags, and more');
  }
  return t('Search for logs, users, tags, and more');
}
