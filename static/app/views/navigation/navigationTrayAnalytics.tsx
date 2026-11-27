import {createContext, useContext} from 'react';

import type {NavigationTrayAnalyticsParams} from 'sentry/utils/analytics/navigationAnalyticsEvents';

import {usePrimaryNavigation} from './primaryNavigationContext';
import {useSecondaryNavigation} from './secondaryNavigationContext';

/**
 * Set around the nav-peek preview card so links inside it can report that they
 * were clicked from a peek, and how long after it opened.
 */
export const NavigationPeekAnalyticsContext = createContext<{openedAt: number} | null>(
  null
);

/**
 * Returns a function that reads the secondary navigation state for
 * `navigation.primary_item_clicked` and `navigation.secondary_item_clicked`.
 * Call it in the click handler so `ms_since_peek_open` is measured at click time.
 */
export function useNavigationTrayAnalyticsParams(): () =>
  | NavigationTrayAnalyticsParams
  | undefined {
  const {layout, hoverBehavior} = usePrimaryNavigation();
  const {view} = useSecondaryNavigation();
  const peek = useContext(NavigationPeekAnalyticsContext);

  return () => {
    if (layout === 'mobile') {
      return;
    }
    const navPeekEnabled = hoverBehavior === 'preview';
    if (peek) {
      return {
        nav_peek_enabled: navPeekEnabled,
        tray_state: 'peek',
        ms_since_peek_open: Date.now() - peek.openedAt,
      };
    }
    return {
      nav_peek_enabled: navPeekEnabled,
      tray_state: view === 'expanded' ? 'pinned' : view,
    };
  };
}
