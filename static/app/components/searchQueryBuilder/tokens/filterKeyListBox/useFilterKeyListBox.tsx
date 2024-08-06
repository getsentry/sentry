import type React from 'react';
import {useCallback, useMemo, useState} from 'react';
import type {ComboBoxState} from '@react-stately/combobox';
import type {Key} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {CustomComboboxMenu} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {FilterKeyListBox} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox';
import type {
  KeyItem,
  KeySectionItem,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';
import clamp from 'sentry/utils/number/clamp';

const MAX_OPTIONS_WITHOUT_SEARCH = 100;
const MAX_OPTIONS_WITH_SEARCH = 8;

export function useFilterKeyListBox({
  items,
  filterValue,
}: {
  filterValue: string;
  items: Array<KeyItem | KeySectionItem>;
}) {
  const {filterKeySections} = useSearchQueryBuilder();
  const [selectedSectionKey, setSelectedSection] = useState<Key | null>(null);

  const sections = useMemo(() => {
    return items.filter(item => 'options' in item);
  }, [items]);

  const shownItems = useMemo(
    () =>
      items.filter(item => {
        if (itemIsSection(item)) {
          return !selectedSectionKey || item.key === selectedSectionKey;
        }

        return true;
      }),
    [items, selectedSectionKey]
  );

  const customMenu: CustomComboboxMenu<KeyItem | KeySectionItem> = useCallback(
    props => {
      return (
        <FilterKeyListBox
          {...props}
          selectedSection={selectedSectionKey}
          setSelectedSection={setSelectedSection}
          sections={sections}
        />
      );
    },
    [sections, selectedSectionKey]
  );

  const shouldShowExplorationMenu =
    filterValue.length === 0 && filterKeySections.length > 0;

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
      {state}: {state: ComboBoxState<KeyItem | KeySectionItem>}
    ) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowLeft': {
          if (state.selectionManager.focusedKey === null) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          const sectionKeyOrder = [null, ...sections.map(section => section.key)];

          const selectedSectionIndex = sectionKeyOrder.indexOf(selectedSectionKey);
          const newIndex = clamp(
            selectedSectionIndex + (e.key === 'ArrowRight' ? 1 : -1),
            0,
            sectionKeyOrder.length - 1
          );
          const newSectionKey = sectionKeyOrder[newIndex];
          setSelectedSection(newSectionKey);
          const selectedSection =
            sections.find(section => section.key === newSectionKey) ?? sections[0];
          state.selectionManager.setFocusedKey(
            selectedSection?.options?.[0]?.key ?? null
          );

          return;
        }
        default:
          return;
      }
    },
    [sections, selectedSectionKey]
  );

  return {
    sectionItems: shouldShowExplorationMenu ? shownItems : items,
    customMenu: shouldShowExplorationMenu ? customMenu : undefined,
    maxOptions:
      filterValue.length === 0 ? MAX_OPTIONS_WITHOUT_SEARCH : MAX_OPTIONS_WITH_SEARCH,
    onKeyDownCapture: shouldShowExplorationMenu ? onKeyDownCapture : undefined,
  };
}
