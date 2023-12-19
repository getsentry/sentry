import {useEffect, useMemo, useState} from 'react';
import first from 'lodash/first';

import {splitProjectsByReplaySupport} from 'sentry/components/replaysOnboarding/utils';
import {
  customMetricOnboardingPlatforms,
  customMetricPlatforms,
} from 'sentry/data/platformCategories';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Project} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';

export function useCurrentProjectState({isActive}: {isActive: boolean}) {
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {selection, isReady} = useLegacyStore(PageFiltersStore);

  const projectsWithCustomMetricSupport = useMemo(
    () => projects.filter(p => p.platform && customMetricPlatforms.has(p.platform)),
    [projects]
  );

  // Projects where we have the onboarding instructions ready:
  const projectsWithOnboarding = useMemo(
    () =>
      projectsWithCustomMetricSupport.filter(
        p => p.platform && customMetricOnboardingPlatforms.has(p.platform)
      ),
    [projectsWithCustomMetricSupport]
  );

  useEffect(() => {
    if (!isActive) {
      setCurrentProject(undefined);
    }
  }, [isActive]);

  useEffect(() => {
    if (currentProject || !projectsLoaded || !projects.length || !isReady || !isActive) {
      return;
    }

    if (!projectsWithCustomMetricSupport) {
      return;
    }

    if (selection.projects.length) {
      const selectedProjectIds = selection.projects.map(String);
      // If we selected something that has onboarding instructions, pick that first
      const projectWithOnboarding = projectsWithOnboarding.find(p =>
        selectedProjectIds.includes(p.id)
      );
      if (projectWithOnboarding) {
        setCurrentProject(projectWithOnboarding);
        return;
      }

      // If we selected something that supports custom metrics pick that
      const projectSupportsMetrics = projectsWithCustomMetricSupport.find(p =>
        selectedProjectIds.includes(p.id)
      );
      if (projectSupportsMetrics) {
        setCurrentProject(projectSupportsMetrics);
        return;
      }
      // Else pick the first selected project
      const firstSelectedProject = projects.find(p => selectedProjectIds.includes(p.id));
      setCurrentProject(firstSelectedProject);
    } else {
      setCurrentProject(
        first(projectsWithOnboarding) || first(projectsWithCustomMetricSupport)
      );
    }
  }, [
    currentProject,
    projectsLoaded,
    projects,
    isReady,
    isActive,
    selection.projects,
    projectsWithOnboarding,
    projectsWithCustomMetricSupport,
  ]);

  const {supported, unsupported} = useMemo(() => {
    return splitProjectsByReplaySupport(projects);
  }, [projects]);

  return {
    projects: projectsWithCustomMetricSupport,
    hasDocs:
      !!currentProject?.platform &&
      customMetricOnboardingPlatforms.has(currentProject.platform),
    allProjects: projects,
    supportedProjects: supported,
    unsupportedProjects: unsupported,
    currentProject,
    setCurrentProject,
  };
}
