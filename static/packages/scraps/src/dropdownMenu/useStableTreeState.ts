import {useMemo} from 'react';
import type {TreeProps, TreeState} from '@react-stately/tree';
import {useTreeState} from '@react-stately/tree';

import type {MenuItemProps} from './item';

/**
 * `useTreeState`, but returns the same object until a value the menu reads
 * changes. React Aria builds a new state object, with a new `SelectionManager`,
 * on every render, so every row's `memo` would fail whenever the list
 * re-renders, e.g. each time its overlay is repositioned.
 *
 * `focusedKey`, `isFocused` and `childFocusStrategy` read refs, so a kept
 * object still returns their current values. Listing them as dependencies
 * gives the rows a new object when they change, so they re-render.
 */
export function useStableTreeState(
  props: TreeProps<MenuItemProps>
): TreeState<MenuItemProps> {
  const state = useTreeState(props);
  const {collection, disabledKeys, expandedKeys, selectionManager} = state;
  const {focusedKey, isFocused, childFocusStrategy, rawSelection} = selectionManager;
  return useMemo(
    () => state,
    // `state` itself is new on every render, so depend on what it holds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      collection,
      disabledKeys,
      expandedKeys,
      focusedKey,
      isFocused,
      childFocusStrategy,
      rawSelection,
    ]
  );
}
