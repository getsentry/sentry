import {useCallback, useEffect, useRef} from 'react';
import {useInteractOutside} from '@react-aria/interactions';

import {
  NAVIGATION_SIDEBAR_COLLAPSE_DELAY_MS,
  NAVIGATION_SIDEBAR_OPEN_DELAY_MS,
} from 'sentry/views/navigation/constants';
import {useNavigation} from 'sentry/views/navigation/navigationContext';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

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
  const {setActivePrimaryNavigationGroup} = useNavigation();
  const {view, setView, interaction, setInteraction} = useSecondaryNavigation();

  const isCollapsed = view !== 'expanded';
  // Keep a ref so event handlers can read the latest isCollapsed value during
  // React's commit phase (e.g. focusout fires while React is unmounting elements).
  const isCollapsedRef = useRef(isCollapsed);
  useEffect(() => {
    isCollapsedRef.current = isCollapsed;
  });

  const isHoveredRef = useRef(false);

  const closeNavigation = useCallback(() => {
    isHoveredRef.current = false;
    setInteraction(null);
    setView('collapsed');
    setActivePrimaryNavigationGroup(null);
  }, [setActivePrimaryNavigationGroup, setInteraction, setView]);

  const navigationParentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigationParentRef.current) return;
    const navigationParentEl = document.querySelector(
      'nav[aria-label="Primary Navigation"]'
    )?.parentElement;
    if (navigationParentEl) {
      navigationParentRef.current = navigationParentEl as HTMLDivElement;
    }
  }, []);

  const shouldNavigationStayOpen = useCallback(() => {
    const hasKeyboardFocus = navigationParentRef.current?.querySelector(':focus-visible');
    const hasOpenMenu = navigationParentRef.current?.querySelector(
      '[aria-expanded="true"]'
    );

    return isHoveredRef.current || interaction.current || hasKeyboardFocus || hasOpenMenu;
  }, [interaction, navigationParentRef]);

  const tryCloseNavigation = useCallback(() => {
    if (shouldNavigationStayOpen()) {
      return;
    }

    closeNavigation();
  }, [closeNavigation, shouldNavigationStayOpen]);

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
        setView('peek');
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
        setView('peek');
      }
    };

    const handleFocusOut = () => {
      if (!isCollapsedRef.current) {
        return;
      }
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
    interaction,
    isCollapsed,
    navigationParentRef,
    setView,
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
    isDisabled: view !== 'peek',
  });

  return {view};
}
