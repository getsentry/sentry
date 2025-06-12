import {useCallback} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Please be careful when using 'activateSidebar' function as a hook dependency,
 * as it gets re-created when the organization gets updated. This may trigger
 * unnecessary re-renders or side effects.
 */
export function useOnboardingSidebar() {
  const organization = useOrganization();
  const activateSidebar = useCallback(
    ({
      source,
      userClicked,
      recordAnalytics = true,
    }: {
      source: QuickStartEventParameters['quick_start.opened']['source'];
      userClicked: boolean;
      recordAnalytics?: boolean;
    }) => {
      // Delay activating the onboarding panel until after the sidebar closes on route change
      setTimeout(() => {
        if (recordAnalytics) {
          trackAnalytics('quick_start.opened', {
            source,
            organization,
            user_clicked: userClicked,
          });
        }
        SidebarPanelStore.activatePanel(SidebarPanelKey.ONBOARDING_WIZARD);
      }, 0);
    },
    [organization]
  );

  return {activateSidebar};
}
