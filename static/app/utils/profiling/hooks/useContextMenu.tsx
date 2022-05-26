import {useState} from 'react';

import {clamp} from 'sentry/utils/profiling/colors/utils';
import {Rect} from 'sentry/utils/profiling/gl/utils';

import {useKeyboardNavigation} from './useKeyboardNavigation';

export function computeBestContextMenuPosition(
  mouse: Rect,
  container: Rect,
  target: Rect
) {
  const maxY = Math.floor(container.height - target.height);
  const minY = container.top;

  const minX = container.left;
  const maxX = Math.floor(container.right - target.width);

  // We add a tiny offset so that the menu is not directly where the user places their cursor.
  const OFFSET = 6;

  return {
    left: clamp(mouse.x + OFFSET, minX, maxX),
    top: clamp(mouse.y + OFFSET, minY, maxY),
  };
}

export function useContextMenu() {
  const [open, setOpen] = useState<boolean>(false);
  const itemProps = useKeyboardNavigation();

  function wrapSetOpen(newOpen: boolean) {
    if (!newOpen) {
      itemProps.setTabIndex(null);
    }
    setOpen(newOpen);
  }

  function getMenuProps() {
    const menuProps = itemProps.getMenuKeyboardEventHandlers();

    return {
      ...menuProps,
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (evt.key === 'Escape') {
          setOpen(false);
        }
        menuProps.onKeyDown(evt);
      },
    };
  }

  function getMenuItemProps() {
    const menuItemProps = itemProps.getMenuItemKeyboardEventHandlers();

    return {
      ...menuItemProps,
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (evt.key === 'Escape') {
          setOpen(false);
        }
        menuItemProps.onKeyDown(evt);
      },
    };
  }

  return {
    open,
    setOpen: wrapSetOpen,
    menuRef: itemProps.menuRef,
    getMenuProps,
    getMenuItemProps,
  };
}
