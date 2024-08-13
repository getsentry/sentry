import type React from 'react';
import {useCallback, useMemo, useState} from 'react';
import type {ComboBoxState} from '@react-stately/combobox';
import type {Key, Node} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {CustomComboboxMenu} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {FilterKeyListBox} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox';
import type {FilterKeyItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {useRecentSearchFilters} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/useRecentSearchFilters';
import {
  createItem,
  createRecentFilterOptionKey,
  createSection,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import clamp from 'sentry/utils/number/clamp';

const MAX_OPTIONS_WITHOUT_SEARCH = 100;
const MAX_OPTIONS_WITH_SEARCH = 8;

function addRecentFiltersToItems({
  items,
  recentFilters,
}: {
  items: FilterKeyItem[];
  recentFilters: string[];
}): FilterKeyItem[] {
  if (!recentFilters.length) {
    return items;
  }
  return [
    ...recentFilters.map(filter => ({
      key: createRecentFilterOptionKey(filter),
      value: filter,
      textValue: filter,
      type: 'recent-filter' as const,
      label: filter,
    })),
    ...items,
  ];
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

  const flatItems = useMemo(() => {
    return Object.values(filterKeys).map(filterKey =>
      createItem(filterKey, getFieldDefinition(filterKey.key))
    );
  }, [filterKeys, getFieldDefinition]);

  const categorizedItems = useMemo(() => {
    return filterKeySections
      .flatMap(section => section.children)
      .reduce<
        Record<string, boolean>
      >((acc, nextFilterKey) => ({...acc, [nextFilterKey]: true}), {});
  }, [filterKeySections]);

  const uncategorizedItems = useMemo(() => {
    return flatItems.filter(item => !categorizedItems[item.value]);
  }, [categorizedItems, flatItems]);

  const sectionedItems = useMemo(() => {
    const sections = filterKeySections.map(section =>
      createSection(section, filterKeys, getFieldDefinition)
    );
    if (uncategorizedItems.length) {
      sections.push({
        key: 'uncategorized',
        value: 'uncategorized',
        label: '',
        options: uncategorizedItems,
        type: 'section',
      });
    }
    return sections;
  }, [filterKeySections, filterKeys, getFieldDefinition, uncategorizedItems]);

  return {sectionedItems};
}

export function useFilterKeyListBox({filterValue}: {filterValue: string}) {
  const {filterKeySections} = useSearchQueryBuilder();
  const [selectedSectionKey, setSelectedSection] = useState<Key | null>(null);

  const {sectionedItems} = useFilterKeyItems();

  const recentFilters = useRecentSearchFilters();

  const filterKeyMenuItems = useMemo(() => {
    const filteredByCategory = sectionedItems.filter(item => {
      if (itemIsSection(item)) {
        return !selectedSectionKey || item.key === selectedSectionKey;
      }

      return true;
    });

    return addRecentFiltersToItems({items: filteredByCategory, recentFilters});
  }, [recentFilters, sectionedItems, selectedSectionKey]);

  const customMenu: CustomComboboxMenu<FilterKeyItem> = props => {
    return (
      <FilterKeyListBox
        {...props}
        selectedSection={selectedSectionKey}
        setSelectedSection={setSelectedSection}
        sections={sectionedItems}
        recentFilters={recentFilters}
      />
    );
  };

  const shouldShowExplorationMenu =
    filterValue.length === 0 && filterKeySections.length > 0;

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
            item => item.props?.type === 'item',
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
      const sectionKeyOrder = [null, ...filterKeySections.map(section => section.value)];

      const selectedSectionIndex = sectionKeyOrder.indexOf(
        selectedSectionKey?.toString() ?? null
      );
      const newIndex = clamp(
        selectedSectionIndex + (e.key === 'ArrowRight' ? 1 : -1),
        0,
        sectionKeyOrder.length - 1
      );
      const newSectionKey = sectionKeyOrder[newIndex];
      setSelectedSection(newSectionKey);
    },
    [filterKeySections, selectedSectionKey]
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
