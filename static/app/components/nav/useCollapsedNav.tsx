import {useCallback, useEffect, useRef, useState} from 'react';
import {useInteractOutside} from '@react-aria/interactions';

import {useNavContext} from 'sentry/components/nav/context';

// Slightly delay closing the nav to prevent accidental dismissal
const CLOSE_DELAY = 300;

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
  const {navParentRef, isCollapsed, isInteractingRef, endInteraction} = useNavContext();

  const [isOpen, setIsOpen] = useState(false);
  const isHoveredRef = useRef(false);

  const closeNav = useCallback(() => {
    isHoveredRef.current = false;
    endInteraction();
    setIsOpen(false);
  }, [endInteraction]);

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
  if (!isCollapsed && isOpen) {
    closeNav();
  }

  // Sets up event listeners hover and focus changes
  useEffect(() => {
    const element = navParentRef.current;
    if (!element || !isCollapsed || !navParentRef.current) {
      return () => {};
    }

    const navParentEl = navParentRef.current;
    let closeTimer: NodeJS.Timeout;

    const hoverIn = () => {
      clearTimeout(closeTimer);
      isHoveredRef.current = true;
      setIsOpen(true);
    };

    const hoverOut = () => {
      isHoveredRef.current = false;

      closeTimer = setTimeout(() => {
        tryCloseNav();
      }, CLOSE_DELAY);
    };

    const handleMouseEnter = () => {
      hoverIn();
    };

    const handleMouseLeave = () => {
      hoverOut();
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) {
        clearTimeout(closeTimer);
        setIsOpen(true);
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
    shouldNavStayOpen,
    tryCloseNav,
  ]);

  // Handles clicks outside the nav container
  // Most of the the nav will already be closed by mouse or focus events,
  // but this will catch instances where clicks on non-focusable elements
  useInteractOutside({
    ref: navParentRef,
    onInteractOutside: () => {
      closeNav();
    },
    isDisabled: !isCollapsed,
  });

  return {isOpen};
}
