import {useRef} from 'react';
import {useHover} from '@react-aria/interactions';

import {NAV_SIDEBAR_COLLAPSE_DELAY_MS} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';

/**
 * Resets the active nav group when the user moves their mouse away from the
 * nav. This is delayed slightly to prevent accidental dismissals.
 */
export function useResetActiveNavGroup() {
  const {setActivePrimaryNavGroup} = useNavContext();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {hoverProps} = useHover({
    onHoverEnd: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setActivePrimaryNavGroup(null);
        // This delay needs to be longer than the collapse delay to prevent
        // content from shifting before the nav closes
      }, NAV_SIDEBAR_COLLAPSE_DELAY_MS + 100);
    },
    onHoverStart: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
  });

  return hoverProps;
}
