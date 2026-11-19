import type * as React from 'react';
import {useKeyboard} from '@react-aria/interactions';
import type {useMenu} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import type {TreeState} from '@react-stately/tree';
import type {Key} from '@react-types/shared';

import type {MenuItemProps} from './item';
import {getMenuItemKey} from './utils';

interface UseDropdownMenuKeyboardOptions {
  /** The keys keyboard focus can reach, in order. */
  focusableKeys: string[];
  /** Props from `useMenu`. */
  menuProps: ReturnType<typeof useMenu>['menuProps'];
  menuRef: React.RefObject<HTMLUListElement | null>;
  searchRef: React.RefObject<HTMLInputElement | null>;
  state: TreeState<MenuItemProps>;
}

/**
 * Keyboard navigation of a menu: moves focus between the search field and the
 * items. Opening and closing submenus with the arrow keys is handled by
 * `useSubmenuTrigger`.
 */
export function useDropdownMenuKeyboard({
  focusableKeys,
  menuProps,
  menuRef,
  searchRef,
  state,
}: UseDropdownMenuKeyboardOptions) {
  /**
   * Moves focus to an item by key. Items outside a virtualized window are not
   * mounted, so focus goes through the selection manager: the list scrolls the
   * item into view and React Aria focuses it once it mounts.
   */
  const focusItem = (key: Key | undefined) => {
    if (key === undefined) {
      return;
    }
    const element = menuRef.current?.querySelector<HTMLElement>(
      `[data-key="${CSS.escape(String(key))}"]`
    );
    if (element) {
      element.focus();
      return;
    }
    state.selectionManager.setFocused(true);
    state.selectionManager.setFocusedKey(key);
  };

  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      // Submenus are portaled, but React still bubbles their events through
      // this menu. Only handle events from this menu's own items.
      if (!menuRef.current?.contains(e.target as HTMLElement)) {
        e.continuePropagation();
        return;
      }
      // Read from the collection rather than the DOM, since a virtualized menu
      // only mounts some of its items. The key comes from the event target:
      // React Aria has already moved focusedKey to the next item by now.
      const targetKey = getMenuItemKey(e.target);
      // When keyboard navigation wraps past the last item, show the top of the
      // list again so the search field and first item are visible.
      if (
        e.key === 'ArrowDown' &&
        searchRef.current &&
        targetKey !== undefined &&
        targetKey === focusableKeys.at(-1)
      ) {
        menuRef.current.scrollTop = 0;
      }
      // Move from the first enabled item back to search before leaving the submenu.
      if (
        e.key === 'ArrowUp' &&
        searchRef.current &&
        targetKey !== undefined &&
        targetKey === focusableKeys[0]
      ) {
        e.preventDefault();
        menuRef.current.scrollTop = 0;
        searchRef.current.focus();
        return;
      }
      e.continuePropagation();
    },
  });

  return {
    focusItem,
    menuProps: mergeProps(menuProps, keyboardProps),
  };
}
