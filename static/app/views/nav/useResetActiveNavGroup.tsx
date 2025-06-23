import type {MouseEventHandler} from 'react';
import {useCallback, useEffect, useRef} from 'react';
import type {DOMAttributes, FocusableElement} from '@react-types/shared';

import {
  NAV_PRIMARY_LINK_DATA_ATTRIBUTE,
  NAV_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  NAV_SIDEBAR_RESET_DELAY_MS,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';

/**
 * Resets the active nav group when the user moves their mouse away from the
 * nav or into the dead space of the primary navigation. This is delayed slightly
 * to prevent accidental dismissals.
 */
export function useResetActiveNavGroup(): DOMAttributes<FocusableElement> {
  const {layout, setActivePrimaryNavGroup} = useNavContext();
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetActiveNavGroup = useCallback(() => {
    if (resetTimeoutRef.current) {
      return;
    }

    resetTimeoutRef.current = setTimeout(() => {
      setActivePrimaryNavGroup(null);
    }, NAV_SIDEBAR_RESET_DELAY_MS);
  }, [setActivePrimaryNavGroup]);

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

        const isInPrimaryNavListContainer =
          target.closest(`[${NAV_PRIMARY_LINK_DATA_ATTRIBUTE}]`) !== null;
        const isInSecondaryNavListContainer =
          target.closest(`[${NAV_SECONDARY_SIDEBAR_DATA_ATTRIBUTE}]`) !== null;

        if (isInPrimaryNavListContainer || isInSecondaryNavListContainer) {
          clearResetTimeout();
        } else {
          resetActiveNavGroup();
        }
      });
    },
    [clearResetTimeout, resetActiveNavGroup]
  );

  const onMouseLeave = useCallback(() => {
    requestAnimationFrame(() => {
      resetActiveNavGroup();
    });
  }, [resetActiveNavGroup]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  if (layout !== NavLayout.SIDEBAR) {
    return {};
  }

  return {
    onMouseMove,
    onMouseLeave,
  };
}
