import {useCallback, useMemo} from 'react';

import {getHasTag} from 'sentry/components/events/searchBar';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {CallbackSearchState} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {SavedSearchType, type Tag, type TagCollection} from 'sentry/types/group';
import type {AggregationKey} from 'sentry/utils/fields';
import {FieldKind, getFieldDefinition} from 'sentry/utils/fields';
import {SPANS_FILTER_KEY_SECTIONS} from 'sentry/views/insights/constants';

import {useTraceItemAttributeValues} from '../hooks/useTraceItemAttributeValues';
import {TraceItemDataset} from '../types';

interface TraceItemSearchQueryBuilderProps {
  /**
   * Required props
   */
  initialQuery: string;
  numberTags: TagCollection;
  searchSource: string;
  stringTags: TagCollection;
  /**
   * Optional props
   */
  dataset?: TraceItemDataset.LOGS;
  datetime?: PageFilters['datetime'];
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  onBlur?: (query: string, state: CallbackSearchState) => void;
  onSearch?: (query: string, state: CallbackSearchState) => void;
  placeholder?: string;
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

export function TraceItemSearchQueryBuilder({
  initialQuery,
  numberTags,
  searchSource,
  stringTags,
  dataset = TraceItemDataset.LOGS,
  datetime: _datetime,
  getFilterTokenWarning,
  onBlur,
  onSearch,
  placeholder,
  portalTarget,
  projects: _projects,
  supportedAggregates = [],
}: TraceItemSearchQueryBuilderProps) {
  const placeholderText = placeholder ?? t('Search for logs, users, tags, and more');

  const functionTags = useMemo(() => {
    return getFunctionTags(supportedAggregates);
  }, [supportedAggregates]);

  const filterTags: TagCollection = useMemo(() => {
    const tags: TagCollection = {...functionTags, ...numberTags, ...stringTags};
    tags.has = getHasTag({...stringTags}); // TODO: add number tags
    return tags;
  }, [numberTags, stringTags, functionTags]);

  const filterKeySections = useMemo(() => {
    const predefined = new Set(
      SPANS_FILTER_KEY_SECTIONS.flatMap(section => section.children)
    );
    return [
      ...SPANS_FILTER_KEY_SECTIONS.map(section => {
        return {
          ...section,
          children: section.children.filter(key => stringTags.hasOwnProperty(key)),
        };
      }),
      {
        value: 'custom_fields',
        label: 'Custom Tags',
        children: Object.keys(stringTags).filter(key => !predefined.has(key)),
      },
    ];
  }, [stringTags]);

  // Use the trace item attributes hook to fetch trace item attribute values
  const {getTraceItemAttributeValues} = useTraceItemAttributeValues({
    dataset,
    fieldKey: '', // Empty as we're only using the callback function
    enabled: true,
  });

  const getTraceItemTagValues = useCallback(
    (tag: Tag, queryString: string) => {
      if (tag.kind === 'function' || numberTags.hasOwnProperty(tag.key)) {
        // We can't really auto suggest values for aggregate functions or numbers
        return Promise.resolve([]);
      }

      // Use the trace item attributes endpoint
      return getTraceItemAttributeValues(tag, queryString);
    },
    [getTraceItemAttributeValues, numberTags]
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
      recentSearches={SavedSearchType.SPAN} // We'll reuse the same recent searches category
      showUnsubmittedIndicator
      portalTarget={portalTarget}
    />
  );
}
