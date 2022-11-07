import {useCallback, useEffect, useState} from 'react';

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

interface UseContextMenuOptions {
  container: HTMLElement | null;
}

export function useContextMenu({container}: UseContextMenuOptions) {
  const [open, setOpen] = useState<boolean>(false);
  const [menuCoordinates, setMenuCoordinates] = useState<Rect | null>(null);
  const [contextMenuCoordinates, setContextMenuCoordinates] = useState<Rect | null>(null);
  const [containerCoordinates, setContainerCoordinates] = useState<Rect | null>(null);

  const itemProps = useKeyboardNavigation();

  // We wrap the setOpen function in a useEffect so that we also clear the keyboard
  // tabIndex when a menu is closed. This prevents tabIndex from being persisted between render
  const wrapSetOpen = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        itemProps.setTabIndex(null);
      }
      setOpen(newOpen);
    },
    [itemProps]
  );

  const getMenuProps = useCallback(() => {
    const menuProps = itemProps.getMenuProps();

    return {
      ...menuProps,
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (evt.key === 'Escape') {
          wrapSetOpen(false);
        }
        menuProps.onKeyDown(evt);
      },
    };
  }, [itemProps, wrapSetOpen]);

  const getMenuItemProps = useCallback(
    ({onClick}: {onClick?: () => void} = {}) => {
      const menuItemProps = itemProps.getItemProps();

      return {
        ...menuItemProps,
        onClick: (evt: React.MouseEvent) => {
          evt.preventDefault();
          onClick?.();
        },
        onKeyDown: (evt: React.KeyboardEvent) => {
          if (evt.key === 'Escape') {
            wrapSetOpen(false);
          }
          if (evt.key === 'Enter') {
            onClick?.();
          }
          menuItemProps.onKeyDown(evt);
        },
      };
    },
    [itemProps, wrapSetOpen]
  );

  const handleContextMenu = useCallback(
    (evt: React.MouseEvent) => {
      if (!container) {
        return;
      }
      evt.preventDefault();
      evt.stopPropagation();

      const parentPosition = container.getBoundingClientRect();

      setContextMenuCoordinates(
        new Rect(
          evt.clientX - parentPosition.left,
          evt.clientY - parentPosition.top,
          0,
          0
        )
      );
      wrapSetOpen(true);
    },
    [wrapSetOpen, container]
  );

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!itemProps.menuRef || itemProps.menuRef.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [itemProps.menuRef]);

  // Observe the menu
  useEffect(() => {
    if (!itemProps.menuRef) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setMenuCoordinates(new Rect(0, 0, contentRect.width, contentRect.height));
    });

    resizeObserver.observe(itemProps.menuRef);

    return () => {
      resizeObserver.disconnect();
    };
  }, [itemProps.menuRef]);

  // Observe the container
  useEffect(() => {
    if (!container) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setContainerCoordinates(new Rect(0, 0, contentRect.width, contentRect.height));
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [container]);

  const position =
    contextMenuCoordinates && containerCoordinates && menuCoordinates
      ? computeBestContextMenuPosition(
          contextMenuCoordinates,
          containerCoordinates,
          menuCoordinates
        )
      : null;

  return {
    open,
    setOpen: wrapSetOpen,
    position,
    containerCoordinates,
    contextMenuCoordinates: position,
    menuRef: itemProps.menuRef,
    handleContextMenu,
    getMenuProps,
    getMenuItemProps,
  };
}
