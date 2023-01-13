import {useCallback, useEffect, useMemo} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {type Project} from 'sentry/types';
import {type PageFilters} from 'sentry/types/core';
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
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const orgSentOneOrMoreReplayEvent = useMemo(() => {
    const selectedProjects = getSelectedProjectList(selection.projects, projects);
    const hasSentOneReplay = selectedProjects.some(project => project.hasReplays);
    return hasSentOneReplay;
  }, [selection.projects, projects]);

  return orgSentOneOrMoreReplayEvent;
}

export function useReplayOnboardingSidebarPanel() {
  const {location} = useRouteContext();
  const hasSentOneReplay = useHaveSelectedProjectsSentAnyReplayEvents();

  useEffect(() => {
    if (hasSentOneReplay && location.hash === '#replay-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.ReplaysOnboarding);
    }
  }, [hasSentOneReplay, location.hash]);

  const activateSidebar = useCallback((event: {preventDefault: () => void}) => {
    event.preventDefault();
    window.location.hash = 'replay-sidequest';
    SidebarPanelStore.activatePanel(SidebarPanelKey.ReplaysOnboarding);
  }, []);

  return {hasSentOneReplay, activateSidebar};
}
