import {useState} from 'react';

import {useKeyboardNavigation} from './useKeyboardNavigation';

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
