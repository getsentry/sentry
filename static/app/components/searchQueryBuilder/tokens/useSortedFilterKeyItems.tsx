import {useMemo} from 'react';
import type Fuse from 'fuse.js';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {KeyItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {createItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';

const FUZZY_SEARCH_OPTIONS: Fuse.IFuseOptions<KeyItem> = {
  keys: ['label', 'description'],
  threshold: 0.2,
  includeMatches: false,
  minMatchCharLength: 1,
};

export function useSortedFilterKeyItems({filterValue}: {filterValue: string}): KeyItem[] {
  const {filterKeys, getFieldDefinition} = useSearchQueryBuilder();
  const flatItems = useMemo<KeyItem[]>(
    () =>
      Object.values(filterKeys).map(filterKey =>
        createItem(filterKey, getFieldDefinition(filterKey.key))
      ),
    [filterKeys, getFieldDefinition]
  );
  const search = useFuzzySearch(flatItems, FUZZY_SEARCH_OPTIONS);

  return useMemo(() => {
    if (!filterValue || !search) {
      return flatItems;
    }

    return search.search(filterValue).map(({item}) => item);
  }, [filterValue, flatItems, search]);
}
