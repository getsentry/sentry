import {useCallback, useEffect} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const FLAG_HASH = '#flag-sidequest';

export type FeatureFlagOnboardingSurface =
  | 'issue_details.flags_section'
  | 'issue_details.flags_drawer'
  | 'org_settings';

export function useFeatureFlagOnboarding({
  analyticsSurface,
}: {
  analyticsSurface: FeatureFlagOnboardingSurface;
}) {
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === FLAG_HASH) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
      trackAnalytics('flags.view-setup-sidebar', {
        organization,
        surface: analyticsSurface,
      });
    }
  }, [location.hash, organization, analyticsSurface]);

  const activateSidebar = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    window.location.hash = FLAG_HASH;
    SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
  }, []);

  return {activateSidebar};
}
