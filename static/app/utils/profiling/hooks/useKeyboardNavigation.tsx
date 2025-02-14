import {useCallback, useEffect, useState} from 'react';

export function useRovingTabIndex(items: any[]) {
  const [tabIndex, setTabIndex] = useState<number | null>(null);

  const onKeyDown = useCallback(
    (evt: React.KeyboardEvent) => {
      if (items.length === 0) {
        return;
      }

      if (evt.key === 'Escape') {
        setTabIndex(null);
      }

      if (evt.key === 'ArrowDown' || evt.key === 'Tab') {
        evt.preventDefault();

        if (tabIndex === items.length - 1 || tabIndex === null) {
          setTabIndex(0);
        } else {
          setTabIndex((tabIndex ?? 0) + 1);
        }
      }

      if (evt.key === 'ArrowUp' || (evt.key === 'Tab' && evt.shiftKey)) {
        evt.preventDefault();

        if (tabIndex === 0 || tabIndex === null) {
          setTabIndex(items.length - 1);
        } else {
          setTabIndex((tabIndex ?? 0) - 1);
        }
      }
    },
    [tabIndex, items]
  );

  return {
    tabIndex,
    setTabIndex,
    onKeyDown,
  };
}

export function useKeyboardNavigation() {
  const [menuRef, setMenuRef] = useState<HTMLDivElement | null>(null);
  const items: Array<{id: number; node: HTMLElement | null}> = [];

  const {tabIndex, setTabIndex, onKeyDown} = useRovingTabIndex(items);

  // There's no easy way to subscribe to the position of an element.
  // Instead we just check if the menuRef is on screen each render.
  //
  // This assumes that the menuRef is positioned at (-9999, -9999)
  // when it's first rendered.
  const boundingRect = menuRef?.getBoundingClientRect();
  const offScreen =
    !boundingRect ||
    (boundingRect.top < 0 &&
      boundingRect.bottom < 0 &&
      boundingRect.left < 0 &&
      boundingRect.right < 0);

  useEffect(() => {
    // Make sure the menu is on screen before trying to focus it.
    // Otherwise, it will scroll to the top of the page. This is
    // because when the menuRef is first rendered, it is given a
    // position at (-9999, -9999) while we try to determine its
    // size so it can be properly position.
    //
    // This has the effect of waiting until the menuRef is correctly
    // positioned before trying to focus.
    if (menuRef && !offScreen && tabIndex === null) {
      menuRef.focus();
    }
  }, [offScreen, menuRef, tabIndex]);

  function getMenuProps() {
    return {
      tabIndex: -1,
      ref: setMenuRef,
      onKeyDown,
    };
  }

  function getItemProps() {
    const idx = items.length;
    items.push({id: idx, node: null});

    return {
      tabIndex: tabIndex === idx ? 0 : -1,
      ref: (node: HTMLElement | null) => {
        if (items[idx]) {
          if (tabIndex === idx) {
            node?.focus();
          }
          items[idx].node = node;
        }
      },
      onMouseOver: () => {
        setTabIndex(idx);
      },
      onMouseEnter: () => {
        setTabIndex(idx);
      },
      onKeyDown,
    };
  }

  return {
    menuRef,
    getItemProps,
    getMenuProps,
    tabIndex,
    setTabIndex,
  };
}
