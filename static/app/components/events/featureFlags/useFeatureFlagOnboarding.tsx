import {useCallback, useEffect} from 'react';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const FLAG_HASH = '#flag-sidequest';

export function useFeatureFlagOnboarding({
  projectPlatform,
}: {
  projectPlatform?: PlatformKey;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();

  useEffect(() => {
    if (location.hash === FLAG_HASH) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
      trackAnalytics('flags.view-setup-sidebar', {
        organization,
        surface: analyticsArea,
        platform: projectPlatform,
      });
    }
  }, [location.hash, organization, analyticsArea, projectPlatform]);

  const activateSidebar = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      window.location.hash = FLAG_HASH;
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
      trackAnalytics('flags.view-setup-sidebar', {
        organization,
        surface: analyticsArea,
        platform: projectPlatform,
      });
    },
    [organization, analyticsArea, projectPlatform]
  );

  return {activateSidebar};
}
