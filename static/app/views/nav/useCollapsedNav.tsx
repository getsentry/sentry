import {useCallback, useEffect, useRef} from 'react';
import {useInteractOutside} from '@react-aria/interactions';

import {
  NAV_SIDEBAR_COLLAPSE_DELAY_MS,
  NAV_SIDEBAR_OPEN_DELAY_MS,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';

const IGNORE_ELEMENTS = [
  // Tooltips are rendered in document.body so will cause the nav to close
  '[data-tooltip="true"]',
];

/**
 * Handles logic for deciding when the collpased nav should be visible.
 *
 * Mouse in -> open
 * Mouse out -> close
 * Keyboard focus on elements within nav -> open
 * Menu open within nav -> open
 * Other interactions (such as dragging) -> open
 * Interaction outside nav -> close
 * Escape -> close
 */
export function useCollapsedNav() {
  const {
    navParentRef,
    isCollapsed,
    isInteractingRef,
    endInteraction,
    setActivePrimaryNavGroup,
    collapsedNavIsOpen,
    setCollapsedNavIsOpen,
  } = useNavContext();

  const isHoveredRef = useRef(false);

  const closeNav = useCallback(() => {
    isHoveredRef.current = false;
    endInteraction();
    setCollapsedNavIsOpen(false);
    setActivePrimaryNavGroup(null);
  }, [endInteraction, setActivePrimaryNavGroup, setCollapsedNavIsOpen]);

  const shouldNavStayOpen = useCallback(() => {
    const hasKeyboardFocus = navParentRef.current?.querySelector(':focus-visible');
    const hasOpenMenu = navParentRef.current?.querySelector('[aria-expanded="true"]');

    return (
      isHoveredRef.current || isInteractingRef.current || hasKeyboardFocus || hasOpenMenu
    );
  }, [isInteractingRef, navParentRef]);

  const tryCloseNav = useCallback(() => {
    if (shouldNavStayOpen()) {
      return;
    }

    closeNav();
  }, [closeNav, shouldNavStayOpen]);

  // Resets hover state if nav is disabled
  // Without this the menu will pop back open when collapsing
  useEffect(() => {
    if (!isCollapsed && collapsedNavIsOpen) {
      closeNav();
    }
  });

  // Sets up event listeners hover and focus changes
  useEffect(() => {
    const element = navParentRef.current;
    if (!element || !isCollapsed || !navParentRef.current) {
      return () => {};
    }

    const navParentEl = navParentRef.current;
    let closeTimer: NodeJS.Timeout;
    let openTimer: NodeJS.Timeout;

    const hoverIn = () => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);

      isHoveredRef.current = true;

      openTimer = setTimeout(() => {
        setCollapsedNavIsOpen(true);
      }, NAV_SIDEBAR_OPEN_DELAY_MS);
    };

    const hoverOut = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);

      isHoveredRef.current = false;

      closeTimer = setTimeout(() => {
        tryCloseNav();
      }, NAV_SIDEBAR_COLLAPSE_DELAY_MS);
    };

    const handleMouseEnter = () => {
      hoverIn();
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // Ignore mouse leave events on overlay elements like tooltips
      if (
        IGNORE_ELEMENTS.some(
          selector =>
            e.relatedTarget instanceof HTMLElement && e.relatedTarget.closest(selector)
        )
      ) {
        return;
      }

      hoverOut();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) {
        clearTimeout(closeTimer);
        setCollapsedNavIsOpen(true);
      }
    };

    const handleFocusOut = () => {
      tryCloseNav();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeNav();
      }
    };

    navParentEl.addEventListener('focusin', handleFocusIn);
    navParentEl.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      navParentEl.removeEventListener('focusin', handleFocusIn);
      navParentEl.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(closeTimer);
    };
  }, [
    closeNav,
    endInteraction,
    isCollapsed,
    isInteractingRef,
    navParentRef,
    setCollapsedNavIsOpen,
    shouldNavStayOpen,
    tryCloseNav,
  ]);

  // Handles clicks outside the nav container
  // Most of the the nav will already be closed by mouse or focus events,
  // but this will catch instances where clicks on non-focusable elements
  useInteractOutside({
    ref: navParentRef,
    onInteractOutside: e => {
      if (
        IGNORE_ELEMENTS.some(
          selector => e.target instanceof HTMLElement && e.target.closest(selector)
        )
      ) {
        return;
      }

      closeNav();
    },
    isDisabled: !isCollapsed || !collapsedNavIsOpen,
  });

  return {isOpen: collapsedNavIsOpen};
}
