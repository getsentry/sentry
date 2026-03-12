import type {MouseEventHandler} from 'react';
import {useCallback, useEffect, useRef} from 'react';
import type {DOMAttributes, FocusableElement} from '@react-types/shared';

import {
  NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE,
  NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  NAVIGATION_SIDEBAR_RESET_DELAY_MS,
} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';

/**
 * Resets the active nav group when the user moves their mouse away from the
 * nav or into the dead space of the primary navigation. This is delayed slightly
 * to prevent accidental dismissals.
 */
export function useResetActiveNavigationGroup(): DOMAttributes<FocusableElement> {
  const {layout, setActivePrimaryNavigationGroup} = useNavigationContext();
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetActiveNavigationGroup = useCallback(() => {
    if (resetTimeoutRef.current) {
      return;
    }

    resetTimeoutRef.current = setTimeout(() => {
      setActivePrimaryNavigationGroup(null);
    }, NAVIGATION_SIDEBAR_RESET_DELAY_MS);
  }, [setActivePrimaryNavigationGroup]);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const onMouseMove = useCallback<MouseEventHandler<FocusableElement>>(
    e => {
      requestAnimationFrame(() => {
        const target = e.target as HTMLElement;

        const isInPrimaryNavigationListContainer =
          target.closest(`[${NAVIGATION_PRIMARY_LINK_DATA_ATTRIBUTE}]`) !== null;
        const isInSecondaryNavigationListContainer =
          target.closest(`[${NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE}]`) !== null;

        if (isInPrimaryNavigationListContainer || isInSecondaryNavigationListContainer) {
          clearResetTimeout();
        } else {
          resetActiveNavigationGroup();
        }
      });
    },
    [clearResetTimeout, resetActiveNavigationGroup]
  );

  const onMouseLeave = useCallback(() => {
    requestAnimationFrame(() => {
      resetActiveNavigationGroup();
    });
  }, [resetActiveNavigationGroup]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  if (layout !== 'sidebar') {
    return {};
  }

  return {
    onMouseMove,
    onMouseLeave,
  };
}
