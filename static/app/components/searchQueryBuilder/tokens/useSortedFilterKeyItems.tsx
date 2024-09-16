import {useMemo} from 'react';
import type Fuse from 'fuse.js';

import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import type {KeyItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/types';
import {createItem} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/utils';
import {defined} from 'sentry/utils';
import {useFuzzySearch} from 'sentry/utils/fuzzySearch';

const FUZZY_SEARCH_OPTIONS: Fuse.IFuseOptions<KeyItem> = {
  keys: ['label', 'description'],
  threshold: 0.2,
  includeMatches: false,
  minMatchCharLength: 1,
};

export function useSortedFilterKeyItems({filterValue}: {filterValue: string}): KeyItem[] {
  const {filterKeys, getFieldDefinition, filterKeySections} = useSearchQueryBuilder();
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
      if (!filterKeySections.length) {
        return flatItems.sort((a, b) => a.textValue.localeCompare(b.textValue));
      }

      return filterKeySections
        .flatMap(section => section.children)
        .map(key => flatItems.find(item => item.key === key))
        .filter(defined);
    }

    return search.search(filterValue).map(({item}) => item);
  }, [filterKeySections, filterValue, flatItems, search]);
}
