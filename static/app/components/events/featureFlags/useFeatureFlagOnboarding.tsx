import {useCallback, useEffect} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function useFeatureFlagOnboarding() {
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === '#flag-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
      trackAnalytics('flags.view-setup-sidebar', {
        organization,
      });
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback((event: {preventDefault: () => void}) => {
    event.preventDefault();
    window.location.hash = 'flag-sidequest';
    SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
  }, []);

  return {activateSidebar};
}
