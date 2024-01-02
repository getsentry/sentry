import {useCallback, useEffect, useMemo} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import useSelectedProjectsHaveField from 'sentry/utils/project/useSelectedProjectsHaveField';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRouteContext} from 'sentry/utils/useRouteContext';

export function useHasOrganizationSentAnyReplayEvents() {
  const {projects, fetching} = useProjects();
  const hasOrgSentReplays = useMemo(() => projects.some(p => p.hasReplays), [projects]);
  return {hasOrgSentReplays, fetching};
}

export function useHaveSelectedProjectsSentAnyReplayEvents() {
  const {hasField: hasSentOneReplay, fetching} =
    useSelectedProjectsHaveField('hasReplays');
  return {hasSentOneReplay, fetching};
}

export function useReplayOnboardingSidebarPanel() {
  const {location} = useRouteContext();
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
