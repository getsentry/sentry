import type * as React from 'react';
import {createContext} from 'react';
import type {RootMenuTriggerState} from '@react-stately/menu';

interface DropdownMenuContextValue {
  /**
   * Ref to the menu element (the `ul` with `role="menu"`) that renders the
   * current items. Submenu triggers pass it to `useSubmenuTrigger` as their
   * parent menu.
   */
  parentMenuRef?: React.RefObject<HTMLElement | null>;
  /**
   * Element that submenus are portaled into. Submenus render outside their
   * parent menu element, so focus moving into a submenu is not mistaken for
   * focus moving to another item of the parent menu, but they stay inside the
   * root overlay, so the root menu does not close on blur.
   */
  portalContainer?: HTMLElement | null;
  /**
   * Menu trigger state (from react-stately's `useMenuTriggerState` shape) for
   * the root (top-most) menu. Tracks which submenus are open, and closes the
   * entire menu system.
   */
  rootMenuState?: RootMenuTriggerState;
}

export const DropdownMenuContext = createContext<DropdownMenuContextValue>({});
