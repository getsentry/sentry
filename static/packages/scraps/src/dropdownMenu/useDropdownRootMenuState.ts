import {useMemo, useState} from 'react';
import type {RootMenuTriggerState} from '@react-stately/menu';
import type {OverlayTriggerState} from '@react-stately/overlays';
import type {Key} from '@react-types/shared';

/**
 * State for the root menu, matching react-stately's `useMenuTriggerState`.
 *
 * `useOverlay` keeps owning the open state and positioning, so this wraps its
 * overlay state instead of creating another one, and adds the stack of open
 * submenus that `useSubmenuTrigger` reads.
 *
 * A root menu rendered inside another menu starts its own tree, but closing
 * it, for example by selecting one of its items, also closes the outer menu.
 */
export function useDropdownRootMenuState(
  overlayState: OverlayTriggerState,
  parentMenuState?: RootMenuTriggerState
): RootMenuTriggerState {
  // Keys of the open submenu triggers, one per submenu level.
  const [expandedKeysStack, setExpandedKeysStack] = useState<Key[]>([]);
  const [wasOpen, setWasOpen] = useState(overlayState.isOpen);
  if (wasOpen !== overlayState.isOpen) {
    setWasOpen(overlayState.isOpen);
    if (!overlayState.isOpen) {
      // The overlay can close without going through `close` below, for example
      // on a click outside. Clear the stack, so the menu does not reopen with
      // its last submenu open.
      setExpandedKeysStack([]);
    }
  }

  // `useOverlayTriggerState` returns a new object on every render, but its
  // callbacks are stable. Depend on those, so the menu context only changes
  // when the open state does.
  const {isOpen, setOpen, open, close, toggle} = overlayState;
  const closeParentMenu = parentMenuState?.close;
  return useMemo<RootMenuTriggerState>(
    () => ({
      isOpen,
      setOpen,
      focusStrategy: 'first',
      open: () => open(),
      toggle: () => toggle(),
      close: () => {
        setExpandedKeysStack([]);
        close();
        closeParentMenu?.();
      },
      expandedKeysStack,
      openSubmenu: (triggerKey, level) =>
        setExpandedKeysStack(stack =>
          // A submenu opens from an item of an open menu, so its level is at
          // most the number of open submenus. Ignore anything deeper rather
          // than leave a gap in the stack.
          level > stack.length ? stack : [...stack.slice(0, level), triggerKey]
        ),
      closeSubmenu: (triggerKey, level) =>
        setExpandedKeysStack(stack =>
          stack[level] === triggerKey ? stack.slice(0, level) : stack
        ),
    }),
    [isOpen, setOpen, open, toggle, close, closeParentMenu, expandedKeysStack]
  );
}
