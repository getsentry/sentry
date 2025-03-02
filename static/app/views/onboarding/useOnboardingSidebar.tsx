import {useCallback} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {QuickStartEventParameters} from 'sentry/utils/analytics/quickStartAnalyticsEvents';
import useOrganization from 'sentry/utils/useOrganization';

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
    // Omitting the organization here as it causes the hook to re-run on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {activateSidebar};
}
