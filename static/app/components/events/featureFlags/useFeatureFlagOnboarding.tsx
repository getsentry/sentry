import {useCallback, useEffect} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const FLAG_HASH = '#flag-sidequest';
export const FLAG_HASH_SKIP_CONFIG = '#flag-sidequest-skip';

export function useFeatureFlagOnboarding() {
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === FLAG_HASH || location.hash === FLAG_HASH_SKIP_CONFIG) {
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
      trackAnalytics('flags.view-setup-sidebar', {
        organization,
      });
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    window.location.hash = FLAG_HASH;
    SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
  }, []);

  // if we detect that event.contexts.flags is set, use this hook instead
  // to skip the configure step
  const activateSidebarSkipConfigure = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    window.location.hash = FLAG_HASH_SKIP_CONFIG;
    SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
  }, []);

  return {activateSidebar, activateSidebarSkipConfigure};
}
