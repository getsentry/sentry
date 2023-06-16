import {useEffect, useMemo, useState} from 'react';
import first from 'lodash/first';

import {splitProjectsByReplaySupport} from 'sentry/components/replaysOnboarding/utils';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {replayOnboardingPlatforms, replayPlatforms} from 'sentry/data/platformCategories';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Project} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';

function useCurrentProjectState({currentPanel}: {currentPanel: '' | SidebarPanelKey}) {
  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const {selection, isReady} = useLegacyStore(PageFiltersStore);

  const isActive = currentPanel === SidebarPanelKey.REPLAYS_ONBOARDING;

  // Projects where we have the onboarding instructions ready:
  const projectsWithOnboarding = useMemo(
    () =>
      projects.filter(
        p => p.platform && replayOnboardingPlatforms.includes(p.platform) && !p.hasReplays
      ),
    [projects]
  );

  // Projects that support replays, but we haven't created the onboarding instructions (yet):
  const projectWithReplaySupport = useMemo(
    () =>
      projects.filter(
        p => p.platform && replayPlatforms.includes(p.platform) && !p.hasReplays
      ),
    [projects]
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

    if (!projectWithReplaySupport) {
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
      }

      // If we selected something that supports replays pick that
      const projectSupportsReplay = projectWithReplaySupport.find(p =>
        selectedProjectIds.includes(p.id)
      );
      if (projectSupportsReplay) {
        setCurrentProject(projectSupportsReplay);
      }
      const firstSelectedProject = projects.find(p => selectedProjectIds.includes(p.id));
      setCurrentProject(firstSelectedProject);
    } else {
      // We have no selection, so pick a project which we've found
      setCurrentProject(first(projectsWithOnboarding) || first(projectWithReplaySupport));
    }
  }, [
    currentProject,
    projectsLoaded,
    projects,
    isReady,
    isActive,
    selection.projects,
    projectsWithOnboarding,
    projectWithReplaySupport,
  ]);

  const {supported, unsupported} = useMemo(() => {
    return splitProjectsByReplaySupport(projects);
  }, [projects]);

  return {
    projects: projectWithReplaySupport,
    allProjects: projects,
    supportedProjects: supported,
    unsupportedProjects: unsupported,
    currentProject,
    setCurrentProject,
  };
}

export default useCurrentProjectState;
