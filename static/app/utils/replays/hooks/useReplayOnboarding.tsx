import {useCallback, useEffect} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useSelectedProjectsHaveField from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function useHaveSelectedProjectsSentAnyReplayEvents() {
  const {hasField: hasSentOneReplay, fetching} =
    useSelectedProjectsHaveField('hasReplays');
  return {hasSentOneReplay, fetching};
}

export function useReplayOnboardingSidebarPanel() {
  const location = useLocation();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === '#replay-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);
      trackAnalytics('replay.list-view-setup-sidebar', {
        organization,
      });
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback((event: {preventDefault: () => void}) => {
    event.preventDefault();
    window.location.hash = 'replay-sidequest';
    SidebarPanelStore.activatePanel(SidebarPanelKey.REPLAYS_ONBOARDING);
  }, []);

  return {activateSidebar};
}
