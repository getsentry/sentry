import {useCallback, useMemo, useState} from 'react';
import type {Key} from '@react-types/shared';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {CustomComboboxMenu} from 'sentry/components/searchQueryBuilder/tokens/combobox';
import {FilterKeyListBox} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox';
import type {
  KeyItem,
  KeySectionItem,
} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {itemIsSection} from 'sentry/components/searchQueryBuilder/tokens/utils';

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
  const [selectedSection, setSelectedSection] = useState<Key | null>(null);

  const sections = useMemo(() => {
    return items.filter(itemIsSection);
  }, [items]);

  const shownItems = useMemo(
    () =>
      items.filter(item => {
        if (itemIsSection(item)) {
          return !selectedSection || item.key === selectedSection;
        }

        return true;
      }),
    [items, selectedSection]
  );

  const customMenu: CustomComboboxMenu<KeyItem | KeySectionItem> = useCallback(
    props => {
      return (
        <FilterKeyListBox
          {...props}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          sections={sections}
        />
      );
    },
    [sections, selectedSection]
  );

  const shouldShowExplorationMenu =
    filterValue.length === 0 && filterKeySections.length > 0;

  return {
    sectionItems: shouldShowExplorationMenu ? shownItems : items,
    customMenu: shouldShowExplorationMenu ? customMenu : undefined,
    maxOptions:
      filterValue.length === 0 ? MAX_OPTIONS_WITHOUT_SEARCH : MAX_OPTIONS_WITH_SEARCH,
  };
}
