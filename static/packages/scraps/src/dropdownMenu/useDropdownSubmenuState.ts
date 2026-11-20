import {useState} from 'react';
import type {RootMenuTriggerState, SubmenuTriggerState} from '@react-stately/menu';
import type {FocusStrategy, Key} from '@react-types/shared';

interface UseDropdownSubmenuStateOptions {
  /** How deep the submenu sits in the menu tree, starting at 0. */
  level: number;
  rootMenuState: RootMenuTriggerState;
  /** Key of the item that opens the submenu. */
  triggerKey: Key;
}

/**
 * State for a submenu trigger, matching react-stately's `useSubmenuTriggerState`.
 *
 * react-stately takes the submenu level from the number of open submenus when
 * the trigger mounts. A virtualized menu mounts triggers as they scroll into
 * view, possibly while a sibling submenu is open, which would place the
 * trigger one level too deep. The level comes from the menu tree instead.
 */
export function useDropdownSubmenuState({
  level,
  rootMenuState,
  triggerKey,
}: UseDropdownSubmenuStateOptions): SubmenuTriggerState {
  const {expandedKeysStack, openSubmenu, closeSubmenu, close: closeAll} = rootMenuState;
  const isOpen = expandedKeysStack[level] === triggerKey;
  const [focusStrategy, setFocusStrategy] = useState<FocusStrategy | null>(null);

  const open = (strategy?: FocusStrategy | null) => {
    setFocusStrategy(strategy ?? null);
    openSubmenu(triggerKey, level);
  };
  const close = () => {
    setFocusStrategy(null);
    closeSubmenu(triggerKey, level);
  };

  return {
    focusStrategy,
    isOpen,
    open,
    close,
    closeAll,
    submenuLevel: level,
    // Unused, kept for parity with OverlayTriggerState.
    setOpen: () => {},
    toggle: strategy => (isOpen ? close() : open(strategy)),
  };
}
