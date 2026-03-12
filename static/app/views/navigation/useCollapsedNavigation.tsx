import {useCallback, useEffect, useRef} from 'react';
import {useInteractOutside} from '@react-aria/interactions';

import {
  NAVIGATION_SIDEBAR_COLLAPSE_DELAY_MS,
  NAVIGATION_SIDEBAR_OPEN_DELAY_MS,
} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';

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
export function useCollapsedNavigation() {
  const {
    navigationParentRef,
    isCollapsed,
    isInteractingRef,
    endInteraction,
    setActivePrimaryNavigationGroup,
    collapsedNavigationIsOpen,
    setCollapsedNavigationIsOpen,
  } = useNavigationContext();

  const isHoveredRef = useRef(false);

  const closeNavigation = useCallback(() => {
    isHoveredRef.current = false;
    endInteraction();
    setCollapsedNavigationIsOpen(false);
    setActivePrimaryNavigationGroup(null);
  }, [endInteraction, setActivePrimaryNavigationGroup, setCollapsedNavigationIsOpen]);

  const shouldNavigationStayOpen = useCallback(() => {
    const hasKeyboardFocus = navigationParentRef.current?.querySelector(':focus-visible');
    const hasOpenMenu = navigationParentRef.current?.querySelector(
      '[aria-expanded="true"]'
    );

    return (
      isHoveredRef.current || isInteractingRef.current || hasKeyboardFocus || hasOpenMenu
    );
  }, [isInteractingRef, navigationParentRef]);

  const tryCloseNavigation = useCallback(() => {
    if (shouldNavigationStayOpen()) {
      return;
    }

    closeNavigation();
  }, [closeNavigation, shouldNavigationStayOpen]);

  // Resets hover state if nav is disabled
  // Without this the menu will pop back open when collapsing
  useEffect(() => {
    if (!isCollapsed && collapsedNavigationIsOpen) {
      closeNavigation();
    }
  });

  // Sets up event listeners hover and focus changes
  useEffect(() => {
    const element = navigationParentRef.current;
    if (!element || !isCollapsed || !navigationParentRef.current) {
      return () => {};
    }

    const navigationParentEl = navigationParentRef.current;
    let closeTimer: NodeJS.Timeout;
    let openTimer: NodeJS.Timeout;

    const hoverIn = () => {
      clearTimeout(closeTimer);
      clearTimeout(openTimer);

      isHoveredRef.current = true;

      openTimer = setTimeout(() => {
        setCollapsedNavigationIsOpen(true);
      }, NAVIGATION_SIDEBAR_OPEN_DELAY_MS);
    };

    const hoverOut = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);

      isHoveredRef.current = false;

      closeTimer = setTimeout(() => {
        tryCloseNavigation();
      }, NAVIGATION_SIDEBAR_COLLAPSE_DELAY_MS);
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
        setCollapsedNavigationIsOpen(true);
      }
    };

    const handleFocusOut = () => {
      tryCloseNavigation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeNavigation();
      }
    };

    navigationParentEl.addEventListener('focusin', handleFocusIn);
    navigationParentEl.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
      navigationParentEl.removeEventListener('focusin', handleFocusIn);
      navigationParentEl.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(closeTimer);
    };
  }, [
    closeNavigation,
    endInteraction,
    isCollapsed,
    isInteractingRef,
    navigationParentRef,
    setCollapsedNavigationIsOpen,
    shouldNavigationStayOpen,
    tryCloseNavigation,
  ]);

  // Handles clicks outside the nav container
  // Most of the the nav will already be closed by mouse or focus events,
  // but this will catch instances where clicks on non-focusable elements
  useInteractOutside({
    ref: navigationParentRef,
    onInteractOutside: e => {
      if (
        IGNORE_ELEMENTS.some(
          selector => e.target instanceof HTMLElement && e.target.closest(selector)
        )
      ) {
        return;
      }

      closeNavigation();
    },
    isDisabled: !isCollapsed || !collapsedNavigationIsOpen,
  });

  return {isOpen: collapsedNavigationIsOpen};
}
