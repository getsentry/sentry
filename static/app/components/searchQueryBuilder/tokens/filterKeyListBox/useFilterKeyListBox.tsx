import type React from 'react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ComboBoxState} from '@react-stately/combobox';
import type {Node} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {CustomComboboxMenu} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {FilterKeyListBox} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox';
import type {
  FilterKeyItem,
  RecentQueryItem,
  Section,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {useRecentSearches} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/useRecentSearches';
import {useRecentSearchFilters} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/useRecentSearchFilters';
import {
  ALL_CATEGORY,
  ALL_CATEGORY_VALUE,
  createRecentFilterItem,
  createRecentFilterOptionKey,
  createRecentQueryItem,
  createSection,
  RECENT_SEARCH_CATEGORY,
  RECENT_SEARCH_CATEGORY_VALUE,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import type {RecentSearch, TagCollection} from 'sentry/types/group';
import clamp from 'sentry/utils/number/clamp';
import usePrevious from 'sentry/utils/usePrevious';

const MAX_OPTIONS_WITHOUT_SEARCH = 100;
const MAX_OPTIONS_WITH_SEARCH = 8;

function makeRecentFilterItems({
  recentFilters,
}: {
  recentFilters: string[];
}): FilterKeyItem[] {
  if (!recentFilters.length) {
    return [];
  }
  return recentFilters.map(filter => createRecentFilterItem({filter}));
}

function makeRecentSearchQueryItems({
  recentSearches,
  filterKeys,
  getFieldDefinition,
}: {
  filterKeys: TagCollection;
  getFieldDefinition: FieldDefinitionGetter;
  recentSearches: RecentSearch[] | undefined;
}): RecentQueryItem[] {
  if (!recentSearches) {
    return [];
  }
  return recentSearches.map(search =>
    createRecentQueryItem({search, filterKeys, getFieldDefinition})
  );
}

/**
 * Finds the next item in the collection that matches the predicate.
 * Iterates in the specified direction.
 */
function findNextMatchingItem(
  state: ComboBoxState<FilterKeyItem>,
  item: Node<FilterKeyItem> | null,
  predicate: (item: Node<FilterKeyItem>) => boolean,
  direction: 'after' | 'before'
): Node<FilterKeyItem> | null {
  let nextItem: Node<FilterKeyItem> | null = item;

  do {
    const nextKey = direction === 'after' ? nextItem?.nextKey : nextItem?.prevKey;
    nextItem = nextKey ? state.collection.getItem(nextKey) : null;
  } while (nextItem && !predicate(nextItem));

  return nextItem;
}

function useFilterKeyItems() {
  const {filterKeySections, getFieldDefinition, filterKeys} = useSearchQueryBuilder();

  const sectionedItems = useMemo(() => {
    const flatFilterKeys = Object.keys(filterKeys);

    const categorizedItems = filterKeySections
      .flatMap(section => section.children)
      .reduce<
        Record<string, boolean>
      >((acc, nextFilterKey) => ({...acc, [nextFilterKey]: true}), {});

    const uncategorizedFilterKeys = flatFilterKeys.filter(
      filterKey => !categorizedItems[filterKey]
    );

    const sections = filterKeySections.map(section =>
      createSection(section, filterKeys, getFieldDefinition)
    );
    if (uncategorizedFilterKeys.length) {
      sections.push(
        createSection(
          {
            value: 'uncategorized',
            label: '',
            children: uncategorizedFilterKeys,
          },
          filterKeys,
          getFieldDefinition
        )
      );
    }
    return sections;
  }, [filterKeySections, filterKeys, getFieldDefinition]);

  return {sectionedItems};
}

function useFilterKeySections({
  recentSearches,
}: {
  recentSearches: RecentSearch[] | undefined;
}) {
  const {filterKeySections, query} = useSearchQueryBuilder();

  const sections = useMemo<Section[]>(() => {
    const definedSections = filterKeySections.map(section => ({
      value: section.value,
      label: section.label,
    }));

    if (!definedSections.length) {
      return [];
    }

    if (recentSearches?.length && !query) {
      return [RECENT_SEARCH_CATEGORY, ALL_CATEGORY, ...definedSections];
    }

    return [ALL_CATEGORY, ...definedSections];
  }, [filterKeySections, query, recentSearches?.length]);

  const [selectedSection, setSelectedSection] = useState<string>(
    sections[0]?.value ?? ''
  );

  const numSections = sections.length;
  const previousNumSections = usePrevious(numSections);
  useEffect(() => {
    if (previousNumSections !== numSections) {
      setSelectedSection(sections[0]!.value);
    }
  }, [numSections, previousNumSections, sections]);

  return {sections, selectedSection, setSelectedSection};
}
export function useFilterKeyListBox({filterValue}: {filterValue: string}) {
  const {filterKeys, getFieldDefinition} = useSearchQueryBuilder();
  const {sectionedItems} = useFilterKeyItems();
  const recentFilters = useRecentSearchFilters();
  const {data: recentSearches} = useRecentSearches();
  const {sections, selectedSection, setSelectedSection} = useFilterKeySections({
    recentSearches,
  });

  const filterKeyMenuItems = useMemo(() => {
    const recentFilterItems = makeRecentFilterItems({recentFilters});

    if (selectedSection === RECENT_SEARCH_CATEGORY_VALUE) {
      return [
        ...recentFilterItems,
        ...makeRecentSearchQueryItems({
          recentSearches,
          filterKeys,
          getFieldDefinition,
        }),
      ];
    }

    const filteredByCategory = sectionedItems.filter(item => {
      if (itemIsSection(item)) {
        if (selectedSection === ALL_CATEGORY_VALUE) {
          return true;
        }
        return item.key === selectedSection;
      }

      return true;
    });

    return [...recentFilterItems, ...filteredByCategory];
  }, [
    filterKeys,
    getFieldDefinition,
    recentFilters,
    recentSearches,
    sectionedItems,
    selectedSection,
  ]);

  const customMenu: CustomComboboxMenu<FilterKeyItem> = props => {
    return (
      <FilterKeyListBox
        {...props}
        selectedSection={selectedSection}
        setSelectedSection={setSelectedSection}
        sections={sections}
        recentFilters={recentFilters}
      />
    );
  };

  const shouldShowExplorationMenu = filterValue.length === 0 && sections.length > 0;

  // This logic allows us to treat the recent filters as a separate section.
  // If we have 5 recent filters, we want arrow up/down to cylce from the
  // first recent filter to the first non-recent filter and vice versa.
  const handleArrowUpDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      {state}: {state: ComboBoxState<FilterKeyItem>}
    ) => {
      const focusedKey = state.selectionManager.focusedKey;
      const focusedItem = state.collection.getItem(focusedKey);

      const direction = e.key === 'ArrowDown' ? 'after' : 'before';
      const nextItem = findNextMatchingItem(
        state,
        focusedItem,
        item => item.type !== 'section',
        direction
      );

      // Default behavior if we are going to a normal filter key
      if (nextItem?.props?.type !== 'recent-filter') {
        return;
      }

      // If we are at a recent filter key and going down, skip to the next non-recent filter key
      if (focusedItem?.props?.type === 'recent-filter') {
        if (direction === 'before') {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const nextNonRecentKey =
          findNextMatchingItem(
            state,
            focusedItem,
            item => ['item', 'recent-query'].includes(item.props?.type),
            direction
          )?.key ?? null;

        state.selectionManager.setFocusedKey(nextNonRecentKey);

        return;
      }

      // If we are at a non-recent filter key and going up, skip to the first recent filter key
      e.preventDefault();
      e.stopPropagation();
      state.selectionManager.setFocusedKey(createRecentFilterOptionKey(recentFilters[0]));

      return;
    },
    [recentFilters]
  );

  const handleCycleRecentFilterKeys = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      {
        state,
        focusedItem,
      }: {focusedItem: Node<FilterKeyItem>; state: ComboBoxState<FilterKeyItem>}
    ) => {
      const direction = e.key === 'ArrowRight' ? 'after' : 'before';
      const nextItem = findNextMatchingItem(
        state,
        focusedItem,
        item => item.type !== 'section',
        direction
      );

      if (nextItem?.props?.type === 'recent-filter') {
        state.selectionManager.setFocusedKey(nextItem.key);
      }
      return;
    },
    []
  );

  const handleCycleSections = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const sectionKeyOrder = sections.map(section => section.value);

      const selectedSectionIndex = sectionKeyOrder.indexOf(selectedSection);
      const newIndex = clamp(
        selectedSectionIndex + (e.key === 'ArrowRight' ? 1 : -1),
        0,
        sectionKeyOrder.length - 1
      );
      const newSectionKey = sectionKeyOrder[newIndex]!;
      setSelectedSection(newSectionKey);
    },
    [sections, selectedSection, setSelectedSection]
  );

  /**
   * Handles switching between sections with ArrowRight and ArrowLeft.
   * Only enabled when the special menu is shown and there is a focused option.
   * This must be implemented with onKeyDownCapture because the focused key gets
   * reset on ArrowRight and ArrowLeft by default [1], so we must intercept the event
   * before that happens.
   *
   * [1]: https://github.com/adobe/react-spectrum/blob/3691c7fc9c4f4138e268704bb776694018f04259/packages/@react-aria/combobox/src/useComboBox.ts#L171
   */
  const onKeyDownCapture = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      {state}: {state: ComboBoxState<FilterKeyItem>}
    ) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        return;
      }

      if (state.selectionManager.focusedKey === null) {
        return;
      }

      const focusedKey = state.selectionManager.focusedKey;
      const focusedItem = state.collection.getItem(focusedKey);

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        handleArrowUpDown(e, {state});
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (focusedItem?.props?.type === 'recent-filter') {
        handleCycleRecentFilterKeys(e, {state, focusedItem});
        return;
      }

      handleCycleSections(e);
    },
    [handleArrowUpDown, handleCycleRecentFilterKeys, handleCycleSections]
  );

  return {
    sectionItems: filterKeyMenuItems,
    customMenu: shouldShowExplorationMenu ? customMenu : undefined,
    maxOptions:
      filterValue.length === 0 ? MAX_OPTIONS_WITHOUT_SEARCH : MAX_OPTIONS_WITH_SEARCH,
    onKeyDownCapture: shouldShowExplorationMenu ? onKeyDownCapture : undefined,
  };
}
