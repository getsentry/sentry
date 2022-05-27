import {useEffect, useState} from 'react';

export function useKeyboardNavigation() {
  const [menuRef, setMenuRef] = useState<HTMLDivElement | null>(null);
  const [tabIndex, setTabIndex] = useState<number | null>(null);

  const items: {id: number; node: HTMLElement | null}[] = [];

  useEffect(() => {
    if (menuRef) {
      if (tabIndex === null) {
        menuRef.focus();
      }
    }
  }, [menuRef, tabIndex]);

  useEffect(() => {
    if (typeof tabIndex !== 'number') {
      return;
    }
    if (items[tabIndex]?.node) {
      items[tabIndex]?.node?.focus();
    }
    // We only want to focus the element if the tabIndex changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIndex]);

  function getMenuKeyboardEventHandlers() {
    return {
      tabIndex: -1,
      ref: setMenuRef,
      onKeyDown: (evt: React.KeyboardEvent) => {
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
    };
  }

  function getMenuItemKeyboardEventHandlers() {
    const idx = items.length;
    items.push({id: idx, node: null});

    return {
      tabIndex: tabIndex === idx ? 0 : -1,
      ref: (node: HTMLElement | null) => {
        if (items[idx]) {
          items[idx].node = node;
        }
      },
      onMouseEnter: () => {
        setTabIndex(idx);
      },
      onKeyDown: (evt: React.KeyboardEvent) => {
        if (items.length === 0) {
          return;
        }

        if (evt.key === 'Escape') {
          setTabIndex(null);
        }

        if (evt.key === 'Enter' || evt.key === ' ') {
          items?.[idx]?.node?.click?.();
        }

        if (evt.key === 'ArrowDown' || evt.key === 'Tab') {
          evt.preventDefault();

          if (tabIndex === items.length || tabIndex === null) {
            setTabIndex(0);
          } else {
            setTabIndex((tabIndex ?? 0) + 1);
          }
        }

        if (evt.key === 'ArrowUp' || (evt.key === 'Tab' && evt.shiftKey)) {
          evt.preventDefault();

          if (tabIndex === 0 || tabIndex === null) {
            setTabIndex(items.length);
          } else {
            setTabIndex((tabIndex ?? 0) - 1);
          }
        }
      },
    };
  }

  return {
    menuRef,
    getMenuItemKeyboardEventHandlers,
    getMenuKeyboardEventHandlers,
    tabIndex,
    setTabIndex,
  };
}
