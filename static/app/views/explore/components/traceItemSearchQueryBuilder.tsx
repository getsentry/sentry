import React, {useMemo} from 'react';
import styled from '@emotion/styled';

import {getHasTag} from 'sentry/components/events/searchBar';
import type {EAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {getKeyLabel} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SavedSearchType, type Tag, type TagCollection} from 'sentry/types/group';
import type {AggregationKey} from 'sentry/utils/fields';
import {
  FieldKind,
  FieldValueType,
  getFieldDefinition,
  type FieldDefinition,
} from 'sentry/utils/fields';
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
  matchKeySuggestions?: Array<{key: string; valuePattern: RegExp}>;
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

const typeMap: Record<TraceItemDataset, 'span' | 'log' | 'uptime'> = {
  [TraceItemDataset.SPANS]: 'span',
  [TraceItemDataset.LOGS]: 'log',
  [TraceItemDataset.UPTIME_RESULTS]: 'uptime',
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
  replaceRawSearchKeys,
  matchKeySuggestions,
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
    getSuggestedFilterKey: getSuggestedAttribute,
    getTagValues: getTraceItemAttributeValues,
    disallowUnsupportedFilters: true,
    recentSearches: itemTypeToRecentSearches(itemType),
    showUnsubmittedIndicator: true,
    portalTarget,
    replaceRawSearchKeys,
    matchKeySuggestions,
    filterKeyAliases: {...numberSecondaryAliases, ...stringSecondaryAliases},
  };
}

export const TraceItemSearchQueryBuilderContext = React.createContext<{
  customKeyRenderer?: (
    tag: Tag,
    fieldDefinition: FieldDefinition | null
  ) => React.ReactNode;
} | null>(null);

const customTraceItemKeyRenderer = (
  tag: Tag,
  fieldDefinition: FieldDefinition | null
) => {
  const baseLabel = getKeyLabel(tag, fieldDefinition);
  const typeLabel = getAttributeTypeLabel(fieldDefinition?.valueType);
  const isSentryTag = tag.key.startsWith('message.parameter.0');
  const hackedType = isSentryTag ? 'number' : typeLabel;
  const isHacked2 = tag.key.startsWith('message.parameter.1');
  const hackedType2 = isHacked2 ? 'boolean' : hackedType;

  return (
    <KeyItemWrapper>
      <KeyLabelSection>
        <span>{baseLabel}</span>
        {isSentryTag && <SentryIcon size="xs" />}
      </KeyLabelSection>
      <TypeIndicator type={hackedType2}>{hackedType2}</TypeIndicator>
    </KeyItemWrapper>
  );
};

/**
 * This component should replace EAPSpansSearchQueryBuilder in the future,
 * once spans support has been added to the trace-items attribute endpoints.
 */
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
}: TraceItemSearchQueryBuilderProps) {
  const searchQueryBuilderProps = useSearchQueryBuilderProps({
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
  });

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
      <TraceItemSearchQueryBuilderContext.Provider
        value={{customKeyRenderer: customTraceItemKeyRenderer}}
      >
        <SearchQueryBuilder autoFocus={autoFocus} {...searchQueryBuilderProps} />
      </TraceItemSearchQueryBuilderContext.Provider>
    </SearchQueryBuilderProvider>
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
          children: section.children.filter(key => stringAttributes.hasOwnProperty(key)),
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

function getAttributeTypeLabel(valueType: FieldValueType | null | undefined): string {
  switch (valueType) {
    case FieldValueType.INTEGER:
    case FieldValueType.NUMBER:
    case FieldValueType.DURATION:
    case FieldValueType.PERCENTAGE:
    case FieldValueType.SIZE:
    case FieldValueType.RATE:
      return 'number';
    case FieldValueType.BOOLEAN:
      return 'boolean';
    case FieldValueType.DATE:
      return 'date';
    case FieldValueType.STRING:
    default:
      return 'string';
  }
}

const KeyItemWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const KeyLabelSection = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  flex: 1;
  min-width: 0;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const SentryIcon = styled(IconSentry)`
  flex-shrink: 0;
  line-height: 1;
  margin-left: ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const TypeIndicator = styled('span')<{type: string}>`
  margin-left: ${space(2)};
  flex-shrink: 0;
  color: ${p => {
    switch (p.type) {
      case 'number':
        return p.theme.yellow400;
      case 'boolean':
        return p.theme.pink400;
      case 'string':
      default:
        return p.theme.purple400;
    }
  }};
`;
