import {useMemo, type ReactNode} from 'react';
import type Fuse from 'fuse.js';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {
  KeySectionItem,
  SearchKeyItem,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {
  createAskSeerConsentItem,
  createAskSeerItem,
  createFilterValueItem,
  createItem,
  createLogicFilterItem,
  createRawSearchFilterContainsValueItem,
  createRawSearchFilterIsValueItem,
  createRawSearchFuzzyFilterItem,
  createRawSearchItem,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import type {Tag} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {FieldKey, FieldKind} from 'sentry/utils/fields';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';
import {keepPreviousData, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';

type FilterKeySearchItem = {
  description: string;
  item: Tag;
  keywords: string[];
  type: 'value' | 'key' | 'logic';
  key?: string;
  value?: string;
};

const FUZZY_SEARCH_OPTIONS: Fuse.IFuseOptions<FilterKeySearchItem> = {
  keys: [
    {name: 'key', weight: 10},
    {name: 'value', weight: 7},
    {name: 'keywords', weight: 2},
    {name: 'description', weight: 1},
  ],
  threshold: 0.2,
  includeMatches: false,
  minMatchCharLength: 1,
  includeScore: true,
  distance: 1000,
};

// Note: we don't need to add in the parentheses because when typed they are
// automatically handled by the parser and tokens created.
const LOGIC_FILTER_ITEMS: FilterKeySearchItem[] = [
  {
    key: 'AND',
    type: 'logic',
    description: 'AND logical operator',
    keywords: [],
    item: {
      key: 'AND',
      name: 'AND',
      kind: FieldKind.FIELD,
      secondaryAliases: [],
    },
  },
  {
    key: 'OR',
    type: 'logic',
    description: 'OR logical operator',
    keywords: [],
    item: {
      key: 'OR',
      name: 'OR',
      kind: FieldKind.FIELD,
      secondaryAliases: [],
    },
  },
];

function isQuoted(inputValue: string) {
  return inputValue.startsWith('"') && inputValue.endsWith('"');
}

// Adds static filter values to the searchable items so that they can be
// suggested if they appear high in the search results.
function getFilterSearchValues(
  keys: Tag[],
  {getFieldDefinition}: {getFieldDefinition: FieldDefinitionGetter}
): FilterKeySearchItem[] {
  return keys.reduce<FilterKeySearchItem[]>((acc, key) => {
    const fieldDef = getFieldDefinition(key.key);
    const values = key.values ?? fieldDef?.values ?? [];

    const addItem = (value: string, description: ReactNode = '') => {
      acc.push({
        value,
        description: typeof description === 'string' ? description : '',
        keywords: [],
        type: 'value',
        item: key,
      });
    };

    for (const value of values) {
      if (typeof value === 'string') {
        addItem(value);
      } else {
        if (value.children.length) {
          for (const child of value.children) {
            if (child.value) {
              addItem(child.value, child.desc ?? child.documentation);
            }
          }
        } else {
          if (value.value) {
            addItem(value.value, value.desc ?? value.documentation);
          }
        }
      }
    }

    return acc;
  }, []);
}

// Returns a section of suggested filter values.
// This will suggest a maximum of 3 options and will display them
// at the top only if the score is better than any of the keys.
function getValueSuggestionsFromSearchResult(
  results: Array<Fuse.FuseResult<FilterKeySearchItem>>
) {
  const suggestions = results
    .filter(result => result.item.type === 'value')
    // Sort HAS suggestions below others because they are less valuable
    .sort((a, b) =>
      a.item.item.key === FieldKey.HAS && b.item.item.key !== FieldKey.HAS ? 1 : -1
    )
    .map(result => createFilterValueItem(result.item.item.key, result.item.value ?? ''))
    .slice(0, 3);

  const suggestedFiltersSection: KeySectionItem = {
    key: 'suggested-filters',
    value: 'suggested-filters',
    label: '',
    options: suggestions,
    type: 'section',
  };

  const topItemIsValueSuggestion = results[0]?.item?.type === 'value';
  const hasValueSuggestions = suggestions.length > 0;

  return {
    shouldShowAtTop: topItemIsValueSuggestion,
    suggestedFiltersSection: hasValueSuggestions ? suggestedFiltersSection : null,
  };
}

export function useSortedFilterKeyItems({
  inputValue,
  filterValue,
  includeSuggestions,
}: {
  filterValue: string;
  includeSuggestions: boolean;
  inputValue: string;
}): {isLoading: boolean; items: SearchKeyItem[]} {
  const {
    filterKeys,
    getFieldDefinition,
    filterKeySections,
    disallowFreeText,
    replaceRawSearchKeys,
    matchKeySuggestions,
    enableAISearch,
    gaveSeerConsent,
    getTagKeys,
  } = useSearchQueryBuilder();

  const organization = useOrganization();
  const hasAskSeerConsentFlowChanges = organization.features.includes(
    'gen-ai-consent-flow-removal'
  );
  const hasConditionalsInCombobox = organization.features.includes(
    'search-query-builder-conditionals-combobox-menus'
  );

  // Async key fetching with debounce when getTagKeys is provided
  const shouldFetchAsync = !!getTagKeys;
  const queryParams = useMemo(
    () => [getTagKeys, filterValue] as const,
    [getTagKeys, filterValue]
  );
  const baseQueryKey = useMemo(
    () => ['search-query-builder-tag-keys', queryParams] as const,
    [queryParams]
  );
  const debouncedQueryKey = useDebouncedValue(baseQueryKey);

  const isDebouncing = baseQueryKey !== debouncedQueryKey;

  const {data: asyncKeys, isFetching} = useQuery({
    queryKey: debouncedQueryKey,
    queryFn: ctx => ctx.queryKey[1][0]!(ctx.queryKey[1][1]),
    placeholderData: keepPreviousData,
    enabled: shouldFetchAsync,
  });

  const isLoading = shouldFetchAsync && (isFetching || isDebouncing);

  const flatKeys = useMemo(() => {
    const keys = Object.values(filterKeys);
    if (!asyncKeys?.length) {
      return keys;
    }
    const existing = new Set(keys.map(k => k.key));
    return [...keys, ...asyncKeys.filter(k => !existing.has(k.key))];
  }, [filterKeys, asyncKeys]);

  // Merged lookup of static + async keys, used for validating search results.
  // Without this, async-only keys would be filtered out by the `filterKeys` check.
  const allKeysLookup = useMemo(() => {
    if (!asyncKeys?.length) {
      return filterKeys;
    }
    const merged = {...filterKeys};
    for (const tag of asyncKeys) {
      if (!(tag.key in merged)) {
        merged[tag.key] = tag;
      }
    }
    return merged;
  }, [filterKeys, asyncKeys]);

  const searchableItems = useMemo<FilterKeySearchItem[]>(() => {
    const searchKeyItems: FilterKeySearchItem[] = flatKeys.map(key => {
      const fieldDef = getFieldDefinition(key.key);

      return {
        key: key.key,
        description: fieldDef?.desc ?? '',
        keywords: fieldDef?.keywords ?? [],
        item: key,
        type: 'key',
      };
    });

    if (includeSuggestions) {
      return [
        ...searchKeyItems,
        ...getFilterSearchValues(flatKeys, {getFieldDefinition}),
        ...(hasConditionalsInCombobox ? LOGIC_FILTER_ITEMS : []),
      ];
    }

    return [...searchKeyItems, ...(hasConditionalsInCombobox ? LOGIC_FILTER_ITEMS : [])];
  }, [flatKeys, getFieldDefinition, hasConditionalsInCombobox, includeSuggestions]);

  const search = useFuzzySearch(searchableItems, FUZZY_SEARCH_OPTIONS);

  const items = useMemo(() => {
    if (!filterValue || !search) {
      if (!filterKeySections.length) {
        return flatKeys
          .map(key => createItem(key, getFieldDefinition(key.key)))
          .sort((a, b) => a.textValue.localeCompare(b.textValue));
      }

      const filterSectionKeys = [
        ...new Set(filterKeySections.flatMap(section => section.children)),
      ].slice(0, 50);

      return filterSectionKeys
        .map(key => allKeysLookup[key])
        .filter(defined)
        .map(key => createItem(key, getFieldDefinition(key.key)));
    }

    const searched = search.search(filterValue);

    const keyItems = searched
      .map(({item: filterSearchKeyItem}) => filterSearchKeyItem)
      .filter(
        filterSearchKeyItem =>
          (filterSearchKeyItem.type === 'key' &&
            allKeysLookup[filterSearchKeyItem.item.key]) ||
          filterSearchKeyItem.type === 'logic'
      )
      .map(filterSearchKeyItem => {
        if (
          filterSearchKeyItem.type === 'logic' &&
          (filterSearchKeyItem.key === 'AND' ||
            filterSearchKeyItem.key === 'OR' ||
            filterSearchKeyItem.key === '(' ||
            filterSearchKeyItem.key === ')')
        ) {
          return createLogicFilterItem({value: filterSearchKeyItem.key});
        }

        const {key} = filterSearchKeyItem.item;
        return createItem(allKeysLookup[key]!, getFieldDefinition(key));
      });

    const askSeerItem = [];
    if (enableAISearch) {
      askSeerItem.push(
        hasAskSeerConsentFlowChanges
          ? createAskSeerItem()
          : gaveSeerConsent
            ? createAskSeerItem()
            : createAskSeerConsentItem()
      );
    }

    if (includeSuggestions) {
      const rawSearchSection: KeySectionItem = {
        key: 'raw-search',
        value: 'raw-search',
        label: '',
        options: [createRawSearchItem(inputValue)],
        type: 'section',
      };

      const shouldIncludeRawSearch =
        !disallowFreeText &&
        inputValue &&
        !isQuoted(inputValue) &&
        (!keyItems.length || inputValue.trim().includes(' ')) &&
        !replaceRawSearchKeys?.length;

      const rawSearchFilterIsValueItems =
        replaceRawSearchKeys?.flatMap(key => {
          const value = inputValue?.includes(' ')
            ? `"${inputValue.replace(/"/g, '')}"`
            : inputValue;

          return [
            createRawSearchFilterContainsValueItem(key, value),
            createRawSearchFilterIsValueItem(key, value),
            ...(/\w \w/.test(inputValue)
              ? [createRawSearchFuzzyFilterItem(key, inputValue)]
              : []),
          ];
        }) ?? [];

      const rawSearchReplacements: KeySectionItem = {
        key: 'raw-search-filter-values',
        value: 'raw-search-filter-values',
        label: '',
        options: [...rawSearchFilterIsValueItems],
        type: 'section',
      };

      const shouldReplaceRawSearch =
        !disallowFreeText &&
        inputValue &&
        !isQuoted(inputValue) &&
        (!keyItems.length || inputValue.trim().includes(' ')) &&
        !!replaceRawSearchKeys?.length;

      const keyItemsSection: KeySectionItem = {
        key: 'key-items',
        value: 'key-items',
        label: '',
        options: keyItems,
        type: 'section',
      };

      const shouldShowMatchKeySuggestions =
        !disallowFreeText &&
        inputValue &&
        !isQuoted(inputValue) &&
        (!keyItems.length || inputValue.trim().includes(' ')) &&
        !!matchKeySuggestions?.length &&
        matchKeySuggestions.some(suggestion => suggestion.valuePattern.test(inputValue));

      let matchKeySuggestionsOptions: SearchKeyItem[] = [];
      if (shouldShowMatchKeySuggestions && matchKeySuggestions) {
        matchKeySuggestionsOptions = matchKeySuggestions
          ?.filter(suggestion => suggestion.valuePattern.test(inputValue))
          .map(suggestion => createFilterValueItem(suggestion.key, inputValue));
      }

      const matchKeySuggestionsSection: KeySectionItem = {
        key: 'key-matched-suggestions',
        value: 'key-matched-suggestions',
        label: '',
        options: matchKeySuggestionsOptions,
        type: 'section',
      };

      const {shouldShowAtTop, suggestedFiltersSection} =
        getValueSuggestionsFromSearchResult(searched);

      return [
        ...(shouldShowMatchKeySuggestions ? [matchKeySuggestionsSection] : []),
        ...(shouldShowAtTop && suggestedFiltersSection ? [suggestedFiltersSection] : []),
        ...(shouldReplaceRawSearch ? [rawSearchReplacements] : []),
        ...(shouldIncludeRawSearch ? [rawSearchSection] : []),
        keyItemsSection,
        ...(!shouldShowAtTop && suggestedFiltersSection ? [suggestedFiltersSection] : []),
        ...askSeerItem,
      ];
    }

    return [...keyItems, ...askSeerItem];
  }, [
    allKeysLookup,
    disallowFreeText,
    enableAISearch,
    filterKeySections,
    filterValue,
    flatKeys,
    gaveSeerConsent,
    getFieldDefinition,
    hasAskSeerConsentFlowChanges,
    includeSuggestions,
    inputValue,
    matchKeySuggestions,
    replaceRawSearchKeys,
    search,
  ]);

  return {items, isLoading};
}
