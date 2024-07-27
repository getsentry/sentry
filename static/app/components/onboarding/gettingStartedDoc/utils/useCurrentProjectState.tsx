import {useEffect, useMemo, useState} from 'react';
import partition from 'lodash/partition';

import type {SidebarPanelKey} from 'sentry/components/sidebar/types';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {PlatformKey, Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';
import useUrlParams from 'sentry/utils/useUrlParams';

type Props = {
  allPlatforms: readonly PlatformKey[];
  currentPanel: '' | SidebarPanelKey;
  onboardingPlatforms: readonly PlatformKey[];
  targetPanel: SidebarPanelKey;
};

function useCurrentProjectState({
  currentPanel,
  targetPanel,
  onboardingPlatforms,
  allPlatforms,
}: Props) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {selection, isReady} = useLegacyStore(PageFiltersStore);
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);
  const {getParamValue: projectIds} = useUrlParams('project');
  const projectId = projectIds()?.split('&').at(0);
  const isActive = currentPanel === targetPanel;

  // Projects with onboarding instructions
  const projectsWithOnboarding = projects.filter(
    p => p.platform && onboardingPlatforms.includes(p.platform)
  );

  const [supportedProjects, unsupportedProjects] = useMemo(() => {
    return partition(projects, p => p.platform && allPlatforms.includes(p.platform));
  }, [projects, allPlatforms]);

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
      !projectsWithOnboarding ||
      !supportedProjects
    ) {
      return;
    }

    if (projectId) {
      setCurrentProject(projects.find(p => p.id === projectId) ?? undefined);
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

      // If we selected something that supports the product pick that
      const projectSupportsProduct = supportedProjects.find(p =>
        selectedProjectIds.includes(p.id)
      );

      if (projectSupportsProduct) {
        setCurrentProject(projectSupportsProduct);
        return;
      }

      // Otherwise, just pick the first selected project
      const firstSelectedProject = projects.find(p => selectedProjectIds.includes(p.id));
      setCurrentProject(firstSelectedProject);
      return;
    }
    // No selection, so pick the first project with onboarding
    setCurrentProject(projectsWithOnboarding.at(0) || supportedProjects.at(0));
    return;
  }, [
    currentProject,
    projectsLoaded,
    projects,
    isReady,
    isActive,
    selection.projects,
    projectsWithOnboarding,
    supportedProjects,
    projectId,
  ]);

  return {
    projects: supportedProjects,
    allProjects: projects,
    currentProject,
    setCurrentProject,
    hasDocs:
      !!currentProject?.platform && onboardingPlatforms.includes(currentProject.platform),
    supportedProjects,
    unsupportedProjects,
  };
}

export default useCurrentProjectState;
