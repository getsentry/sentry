import {useCallback, useMemo} from 'react';

import {getHasTag} from 'sentry/components/events/searchBar';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType, type Tag, type TagCollection} from 'sentry/types/group';
import type {AggregationKey} from 'sentry/utils/fields';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {LOGS_FILTER_KEY_SECTIONS} from 'sentry/views/explore/logs/constants';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

import {useTraceItemAttributeValues} from '../hooks/useTraceItemAttributeValues';
import {TraceItemDataset} from '../types';

interface TraceItemSearchQueryBuilderProps {
  initialQuery: string;
  itemType: TraceItemDataset.LOGS; // This should include TraceItemDataset.SPANS etc.
  numberAttributes: TagCollection;
  searchSource: string;
  stringAttributes: TagCollection;
  datetime?: PageFilters['datetime'];
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  portalTarget?: HTMLElement | null;
  projects?: PageFilters['projects'];
  supportedAggregates?: AggregationKey[];
}

export const getFunctionTags = (supportedAggregates?: AggregationKey[]) => {
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

function getTraceItemFieldDefinitionFunction(tags: TagCollection) {
  return (key: string) => {
    return getFieldDefinition(key, 'span', tags[key]?.kind);
  };
}

/**
 * This component should replace EAPSpansSearchQueryBuilder in the future,
 * once spans support has been added to the trace-items attribute endpoints.
 */
export function TraceItemSearchQueryBuilder({
  initialQuery,
  numberAttributes,
  searchSource,
  stringAttributes,
  itemType,
  datetime: _datetime,
  getFilterTokenWarning,
  onBlur,
  onSearch,
  portalTarget,
  projects: _projects,
  supportedAggregates = [],
}: TraceItemSearchQueryBuilderProps) {
  const placeholderText = itemTypeToDefaultPlaceholder(itemType);
  const functionTags = useFunctionTags(itemType, supportedAggregates);
  const filterTags = useFilterTags(numberAttributes, stringAttributes, functionTags);
  const filterKeySections = useFilterKeySections(itemType, stringAttributes);

  const {getTraceItemAttributeValues} = useTraceItemAttributeValues({
    traceItemType: itemType,
    attributeKey: '', // Empty as we're only using the callback function
    enabled: true,
    type: 'string', // Only string attributes are supported for now
  });

  const getTraceItemTagValues = useCallback(
    (tag: Tag, queryString: string) => {
      if (tag.kind === 'function' || numberAttributes.hasOwnProperty(tag.key)) {
        // We can't really auto suggest values for aggregate functions or numbers
        return Promise.resolve([]);
      }

      // Use the trace item attributes endpoint
      return getTraceItemAttributeValues(tag, queryString);
    },
    [getTraceItemAttributeValues, numberAttributes]
  );

  return (
    <SearchQueryBuilder
      placeholder={placeholderText}
      filterKeys={filterTags}
      initialQuery={initialQuery}
      fieldDefinitionGetter={getTraceItemFieldDefinitionFunction(filterTags)}
      onSearch={onSearch}
      onBlur={onBlur}
      getFilterTokenWarning={getFilterTokenWarning}
      searchSource={searchSource}
      filterKeySections={filterKeySections}
      getTagValues={getTraceItemTagValues}
      disallowUnsupportedFilters
      recentSearches={itemTypeToRecentSearches(itemType)}
      showUnsubmittedIndicator
      portalTarget={portalTarget}
    />
  );
}

function useFunctionTags(
  itemType: TraceItemDataset,
  supportedAggregates?: AggregationKey[]
) {
  if (itemType === TraceItemDataset.SPANS) {
    return getFunctionTags(supportedAggregates);
  }
  return {};
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
    tags.has = getHasTag({...stringAttributes});
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
    ];
  }, [stringAttributes, itemType]);
}

function itemTypeToRecentSearches(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SavedSearchType.SPAN;
  }
  // TODO: Add logs recent searches
  return SavedSearchType.SPAN;
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
