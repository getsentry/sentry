import {useCallback, useEffect, useMemo} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {Project} from 'sentry/types';
import {PageFilters} from 'sentry/types/core';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useRouteContext} from 'sentry/utils/useRouteContext';

function getSelectedProjectList(
  selectedProjects: PageFilters['projects'],
  projects: Project[]
) {
  if (selectedProjects[0] === ALL_ACCESS_PROJECTS || selectedProjects.length === 0) {
    return projects;
  }

  const projectsByProjectId = projects.reduce<Record<string, Project>>((acc, project) => {
    acc[project.id] = project;
    return acc;
  }, {});
  return selectedProjects.map(id => projectsByProjectId[id]).filter(Boolean);
}

export function useHaveSelectedProjectsSentAnyReplayEvents() {
  const {projects, fetching} = useProjects();
  const {selection} = usePageFilters();

  const orgSentOneOrMoreReplayEvent = useMemo(() => {
    const selectedProjects = getSelectedProjectList(selection.projects, projects);
    const hasSentOneReplay = selectedProjects.some(project => project.hasReplays);
    return hasSentOneReplay;
  }, [selection.projects, projects]);

  return {
    hasSentOneReplay: orgSentOneOrMoreReplayEvent,
    fetching,
  };
}

export function useReplayOnboardingSidebarPanel() {
  const {location} = useRouteContext();
  const organization = useOrganization();

  useEffect(() => {
    if (location.hash === '#replay-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.ReplaysOnboarding);
      trackAdvancedAnalyticsEvent('replay.list-view-setup-sidebar', {
        organization,
      });
    }
  }, [location.hash, organization]);

  const activateSidebar = useCallback((event: {preventDefault: () => void}) => {
    event.preventDefault();
    window.location.hash = 'replay-sidequest';
    SidebarPanelStore.activatePanel(SidebarPanelKey.ReplaysOnboarding);
  }, []);

  return {activateSidebar};
}
