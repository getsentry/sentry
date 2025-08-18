import {useCallback, useEffect, useMemo, useState} from 'react';

import {closeModal} from 'sentry/actionCreators/modal';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {useShortcuts} from 'sentry/utils/keyboardShortcuts';
import {KeyboardShortcut} from 'sentry/utils/keyboardShortcuts/components/keyboardKey';

import type {ChildProps, ResultItem} from './types';
import {makeResolvedTs} from './utils';

type Props = {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  /**
   * fuse.js options
   */
  searchOptions?: Fuse.IFuseOptions<any>;
};

/**
 * This source searches through available keyboard shortcuts
 */
function ShortcutsSource({searchOptions, query, children}: Props) {
  const {activeShortcuts} = useShortcuts();
  const [fuzzy, setFuzzy] = useState<Fuse<any> | null>(null);

  const createSearch = useCallback(async () => {
    // Create searchable items from shortcuts with the final display format
    const searchableShortcuts = activeShortcuts
      .filter(shortcut => shortcut.enabled !== false)
      .map(shortcut => ({
        // Store original shortcut data
        originalShortcut: shortcut,
        // Use the final display format for search
        title: shortcut.description,
        description: `Keyboard Shortcut: ${shortcut.context || 'Global'}`,
        // Create searchable text that includes both description and key combination
        searchText: `${shortcut.description} ${Array.isArray(shortcut.key) ? shortcut.key.join(' ') : shortcut.key}`,
      }));

    setFuzzy(
      await createFuzzySearch(searchableShortcuts, {
        ...searchOptions,
        keys: ['title', 'searchText'], // Search on title (action) and searchText, not description
        threshold: 0.3,
      })
    );
  }, [activeShortcuts, searchOptions]);

  useEffect(() => {
    void createSearch();
  }, [createSearch]);

  const results = useMemo(() => {
    const resolvedTs = makeResolvedTs();
    return (
      fuzzy?.search(query).map(({item, ...rest}) => {
        // Get the primary key combination to display from the original shortcut
        const originalShortcut = item.originalShortcut;
        const primaryKey = Array.isArray(originalShortcut.key)
          ? originalShortcut.key[0]
          : originalShortcut.key;

        const resultItem = {
          title: item.title, // Already formatted: shortcut description
          description: item.description, // Already formatted: "Keyboard Shortcuts: context"
          extra: <KeyboardShortcut shortcut={primaryKey} size="xs" />,
          sourceType: 'keyboard',
          resultType: 'keyboard-shortcut',
          resolvedTs,
          action: () => {
            // Execute the shortcut and close the command palette
            const syntheticEvent = new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
            });
            originalShortcut.handler(syntheticEvent);
            closeModal();
          },
        } as ResultItem;

        return {
          item: resultItem,
          ...rest,
        };
      }) ?? []
    );
  }, [fuzzy, query]);

  return children({isLoading: fuzzy === null, results});
}

export default ShortcutsSource;
