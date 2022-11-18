import {useCallback, useEffect, useMemo} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {Project} from 'sentry/types';
import {PageFilters} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useRouteContext} from 'sentry/utils/useRouteContext';

function getProjectList(selectedProjects: PageFilters['projects'], projects: Project[]) {
  if (selectedProjects[0] === ALL_ACCESS_PROJECTS || selectedProjects.length === 0) {
    return projects;
  }

  const projectsByProjectId = projects.reduce<Record<string, Project>>((acc, project) => {
    acc[project.id] = project;
    return acc;
  }, {});
  return selectedProjects.map(id => projectsByProjectId[id]).filter(Boolean);
}

function useShouldShowOnboardingPanel() {
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const shouldShowOnboardingPanel = useMemo(() => {
    const projectList = getProjectList(selection.projects, projects);
    const hasSentOneReplay = projectList.some(project => project.hasReplays);
    return !hasSentOneReplay;
  }, [selection.projects, projects]);

  return shouldShowOnboardingPanel;
}

function useReplayOnboardingSidebarPanel() {
  const {location} = useRouteContext();
  const enabled = useShouldShowOnboardingPanel();

  useEffect(() => {
    if (enabled && location.hash === '#replay-sidequest') {
      SidebarPanelStore.activatePanel(SidebarPanelKey.ReplaysOnboarding);
    }
  }, [enabled, location.hash]);

  const activate = useCallback(event => {
    event.preventDefault();
    window.location.hash = 'replay-sidequest';
    SidebarPanelStore.activatePanel(SidebarPanelKey.ReplaysOnboarding);
  }, []);

  return {enabled, activate};
}

export default useReplayOnboardingSidebarPanel;
