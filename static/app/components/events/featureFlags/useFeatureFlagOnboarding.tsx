import {useCallback, useEffect} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

const FLAG_HASH = '#flag-sidequest';
export const FLAG_HASH_SKIP_CONFIG = '#flag-sidequest-skip';

export function useFeatureFlagOnboarding() {
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();

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
  // to hide the eval tracking SDK configuration.
  const activateSidebarSkipConfigure = useCallback(
    (event: React.MouseEvent, projectId: string) => {
      event.preventDefault();
      navigate(
        {
          pathname: location.pathname,
          // Adding the projectId will help pick the correct project in onboarding
          query: {...location.query, project: projectId},
          hash: FLAG_HASH_SKIP_CONFIG,
        },
        {replace: true}
      );
      SidebarPanelStore.activatePanel(SidebarPanelKey.FEATURE_FLAG_ONBOARDING);
    },
    [navigate, location.pathname, location.query]
  );

  return {activateSidebar, activateSidebarSkipConfigure};
}
