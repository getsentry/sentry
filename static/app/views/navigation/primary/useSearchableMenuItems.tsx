import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from '@sentry/scraps/input';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';

/**
 * A menu item paired with the plain text that the query is matched against.
 * `MenuItemProps.label` is often a React node (e.g. a badge), so the searchable
 * text has to be supplied separately.
 */
interface SearchableMenuItem {
  item: MenuItemProps;
  searchText: string;
}

interface UseSearchableMenuItemsOptions {
  /**
   * Items to filter, each paired with the text to match the query against.
   */
  items: SearchableMenuItem[];
  /**
   * Rendered when the query matches nothing.
   */
  emptyMessage?: string;
  /**
   * Minimum number of items before the search field is shown. Below this the
   * list is short enough to scan by eye.
   */
  minItemsForSearch?: number;
  placeholder?: string;
}

interface SearchableMenuItemsResult {
  /**
   * The items matching the current query, to pass as the submenu's `children`.
   */
  items: MenuItemProps[];
  /**
   * The search field, to pass as the submenu's `title`. `null` when there are
   * too few items to be worth filtering.
   */
  title: React.ReactNode;
}

/**
 * `DropdownMenu` has no built-in filtering, so this hook provides it for a
 * submenu: it returns a search field to render as the submenu's title, plus the
 * items matching what the user typed.
 *
 * The field goes in the title rather than in the item list because the title
 * renders outside the menu's `ul` — inside it, react-aria's typeahead and
 * arrow-key navigation would swallow the keystrokes, and the enclosing menu
 * item's accessible name would track the input's value.
 */
export function useSearchableMenuItems({
  items,
  placeholder,
  emptyMessage,
  minItemsForSearch = 7,
}: UseSearchableMenuItemsOptions): SearchableMenuItemsResult {
  const [query, setQuery] = useState('');
  const isSearchable = items.length >= minItemsForSearch;

  const matches = useMemo(
    () => (isSearchable ? filterMenuItems(items, query) : items),
    [isSearchable, items, query]
  );

  // Let Escape close the menu, but keep the rest of the keystrokes here rather
  // than letting the parent menu act on them.
  const stopPropagation = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') {
      event.stopPropagation();
    }
  }, []);

  const title = useMemo((): React.ReactNode => {
    if (!isSearchable) {
      return null;
    }

    return (
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch size="xs" variant="muted" />
        </InputGroup.LeadingItems>
        <SearchInput
          autoFocus
          size="xs"
          // Password managers try to autofill menu inputs.
          data-1p-ignore
          aria-label={placeholder ?? t('Search')}
          placeholder={placeholder ?? t('Search')}
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
        />
      </InputGroup>
    );
  }, [isSearchable, placeholder, query, stopPropagation]);

  const resolvedItems = useMemo(() => {
    if (isSearchable && matches.length === 0) {
      return [
        {
          key: 'no-results',
          label: emptyMessage ?? t('No results'),
          disabled: true,
        },
      ];
    }

    return matches.map(({item}) => item);
  }, [isSearchable, matches, emptyMessage]);

  return {title, items: resolvedItems};
}

/**
 * Case-insensitive substring match, ranking items whose text starts with the
 * query above those that merely contain it.
 */
function filterMenuItems(
  items: SearchableMenuItem[],
  query: string
): SearchableMenuItem[] {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return items;
  }

  const scored: Array<{index: number; score: number; searchable: SearchableMenuItem}> =
    [];

  items.forEach((searchable, index) => {
    const matchIndex = searchable.searchText.toLowerCase().indexOf(trimmedQuery);

    if (matchIndex === -1) {
      return;
    }

    scored.push({searchable, index, score: matchIndex === 0 ? 0 : 1});
  });

  // Stable sort: preserve the caller's ordering within each score bucket.
  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({searchable}) => searchable);
}

const SearchInput = styled(InputGroup.Input)`
  appearance: none;
`;
