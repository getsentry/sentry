import {useEffect, useState} from 'react';

import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {feedbackOnboardingPlatforms} from 'sentry/data/platformCategories';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Project} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';

function useCurrentProjectState({currentPanel}: {currentPanel: '' | SidebarPanelKey}) {
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {selection, isReady} = useLegacyStore(PageFiltersStore);

  const isActive = currentPanel === SidebarPanelKey.FEEDBACK_ONBOARDING;

  // Projects with onboarding instructions
  const projectsWithOnboarding = projects.filter(
    p => p.platform && feedbackOnboardingPlatforms.includes(p.platform)
  );

  useEffect(() => {
    if (!isActive) {
      setCurrentProject(undefined);
      return;
    }

    if (
      currentProject ||
      !projectsLoaded ||
      !projects.length ||
      !isReady ||
      !projectsWithOnboarding
    ) {
      return;
    }

    if (selection.projects.length) {
      const selectedProjectIds = selection.projects.map(String);

      // If we selected something that has onboarding instructions, pick that first
      const projectForOnboarding = projectsWithOnboarding.find(p =>
        selectedProjectIds.includes(p.id)
      );

      if (projectForOnboarding) {
        setCurrentProject(projectForOnboarding);
        return;
      }

      // Otherwise, just pick the first selected project
      const firstSelectedProject = projects.find(p => selectedProjectIds.includes(p.id));
      setCurrentProject(firstSelectedProject);
      return;
    }
    // No selection, so pick the first project with onboarding
    setCurrentProject(projectsWithOnboarding.at(0));
    return;
  }, [
    currentProject,
    projectsLoaded,
    projects,
    isReady,
    isActive,
    selection.projects,
    projectsWithOnboarding,
  ]);

  return {
    projectsWithOnboarding,
    projects,
    currentProject,
    setCurrentProject,
  };
}

export default useCurrentProjectState;
