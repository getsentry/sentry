import type * as React from 'react';
import {useMemo} from 'react';
import {useKeyboard} from '@react-aria/interactions';
import type {useMenu} from '@react-aria/menu';
import {mergeProps} from '@react-aria/utils';
import type {TreeState} from '@react-stately/tree';
import type {Key, Node} from '@react-types/shared';

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
  /** Top-level nodes of the menu, in order. */
  stateCollection: Array<Node<MenuItemProps>>;
  /** Menu state of the parent menu, if this menu is a submenu. */
  parentMenuState?: TreeState<MenuItemProps>;
}

/**
 * Keyboard navigation of a menu: moves focus between the search field and the
 * items, closes a submenu with ArrowLeft, and ignores key events unless this
 * menu is the focused (leaf) one.
 */
export function useDropdownMenuKeyboard({
  focusableKeys,
  menuProps,
  menuRef,
  parentMenuState,
  searchRef,
  state,
  stateCollection,
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
      // Read from the collection rather than the DOM, since a virtualized menu
      // only mounts some of its items. The key comes from the event target:
      // React Aria has already moved focusedKey to the next item by now.
      const targetKey = getMenuItemKey(e.target);
      // When keyboard navigation wraps past the last item, show the top of the
      // list again so the search field and first item are visible.
      if (
        e.key === 'ArrowDown' &&
        searchRef.current &&
        menuRef.current &&
        targetKey !== undefined &&
        targetKey === focusableKeys.at(-1)
      ) {
        menuRef.current.scrollTop = 0;
      }
      // Move from the first enabled item back to search before leaving the submenu.
      if (
        e.key === 'ArrowUp' &&
        searchRef.current &&
        menuRef.current &&
        targetKey !== undefined &&
        targetKey === focusableKeys[0]
      ) {
        e.preventDefault();
        menuRef.current.scrollTop = 0;
        searchRef.current.focus();
        return;
      }
      // ArrowLeft closes a submenu, but leaves the root menu open.
      if (e.key === 'ArrowLeft' && parentMenuState) {
        parentMenuState.selectionManager.clearSelection();
        return;
      }
      e.continuePropagation();
    },
  });

  /**
   * Whether this menu/submenu is the current focused one, which in a nested,
   * tree-like menu system should be the leaf submenu. This information is
   * used for controlling keyboard events. See ``modifiedMenuProps` below.
   */
  const hasFocus = useMemo(() => {
    // A submenu is a leaf when it does not contain any expanded submenu. This
    // logically follows from the tree-like structure and single-selection
    // nature of menus.
    const isLeafSubmenu = !stateCollection.some(node => {
      const isSection = node.hasChildNodes && !node.value?.submenu;
      // A submenu with key [key] is expanded if
      // state.selectionManager.isSelected([key]) = true
      return isSection
        ? [...node.childNodes].some(child =>
            state.selectionManager.isSelected(`${child.key}`)
          )
        : state.selectionManager.isSelected(`${node.key}`);
    });

    return isLeafSubmenu;
  }, [stateCollection, state.selectionManager]);

  // Menu props from useMenu, modified to disable keyboard events if the
  // current menu does not have focus.
  const modifiedMenuProps = useMemo(
    () => ({
      ...menuProps,
      ...(!hasFocus && {
        onKeyUp: () => null,
        onKeyDown: () => null,
      }),
    }),
    [menuProps, hasFocus]
  );

  return {
    focusItem,
    hasFocus,
    menuProps: mergeProps(modifiedMenuProps, keyboardProps),
  };
}
