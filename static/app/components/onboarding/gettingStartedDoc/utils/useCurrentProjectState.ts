import {useCallback, useEffect, useMemo, useState} from 'react';
import partition from 'lodash/partition';

import type {SidebarPanelKey} from 'sentry/components/sidebar/types';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {PlatformKey, Project} from 'sentry/types/project';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useProjects from 'sentry/utils/useProjects';

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
  const {getParamValue: projectIds} = useUrlParams('project');
  const projectId = projectIds()?.split('&').at(0);
  const isActive = currentPanel === targetPanel;

  // Projects with onboarding instructions
  const projectsWithOnboarding = useMemo(
    () => projects.filter(p => p.platform && onboardingPlatforms.includes(p.platform)),
    [projects, onboardingPlatforms]
  );

  const [supportedProjects, unsupportedProjects] = useMemo(() => {
    return partition(projects, p => p.platform && allPlatforms.includes(p.platform));
  }, [projects, allPlatforms]);

  const getDefaultCurrentProjectFromSelection = useCallback(
    (selectedProjects: Project[]): Project | undefined => {
      if (!isActive || !selectedProjects.length) {
        return undefined;
      }

      const selectedProjectIds = selectedProjects.map(p => p.id);

      // If we selected something that has onboarding instructions, pick that first
      const projectForOnboarding = projectsWithOnboarding.find(p =>
        selectedProjectIds.includes(p.id)
      );

      if (projectForOnboarding) {
        return projectForOnboarding;
      }

      // If we selected something that supports the product pick that
      const projectSupportsProduct = supportedProjects.find(p =>
        selectedProjectIds.includes(p.id)
      );

      if (projectSupportsProduct) {
        return projectSupportsProduct;
      }

      // Otherwise, just pick the first selected project
      return selectedProjects[0];
    },
    [isActive, projectsWithOnboarding, supportedProjects]
  );

  const getDefaultCurrentProject = useCallback((): Project | undefined => {
    if (!isActive) {
      return undefined;
    }

    if (
      !projectsLoaded ||
      !projects.length ||
      !isReady ||
      !projectsWithOnboarding ||
      !supportedProjects
    ) {
      return undefined;
    }

    if (projectId) {
      return projects.find(p => p.id === projectId);
    }

    const selectedProjects = getSelectedProjectList(selection.projects, projects);

    return getDefaultCurrentProjectFromSelection(selectedProjects);
  }, [
    getDefaultCurrentProjectFromSelection,
    isActive,
    isReady,
    projectId,
    projects,
    projectsLoaded,
    projectsWithOnboarding,
    selection.projects,
    supportedProjects,
  ]);

  const defaultCurrentProject = getDefaultCurrentProject();

  const [currentProject, setCurrentProject] = useState<Project | undefined>(
    defaultCurrentProject
  );

  // Update default project if none is set
  useEffect(() => {
    if (!isActive) {
      return;
    }
    setCurrentProject(oldProject => oldProject ?? defaultCurrentProject);
  }, [setCurrentProject, defaultCurrentProject, isActive]);

  // Update the current project when the page filters store changes
  useEffect(() => {
    const selectedProjects = getSelectedProjectList(selection.projects, projects);
    const newSelectionProject = getDefaultCurrentProjectFromSelection(selectedProjects);
    if (newSelectionProject) {
      setCurrentProject(newSelectionProject);
    }
  }, [selection.projects, getDefaultCurrentProjectFromSelection, projects]);

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
