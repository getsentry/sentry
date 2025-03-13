import {useCallback} from 'react';

import type {Organization} from 'sentry/types/organization';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

export function hasLaravelInsightsFeature(organization: Organization) {
  return organization.features.includes('laravel-insights');
}

export function useIsLaravelInsightsAvailable() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  return selectedProjects.length === 1 && hasLaravelInsightsFeature(organization);
}

export function useIsLaravelInsightsEnabled() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const user = useUser();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);
  const isSingleProject = selectedProjects.length === 1;
  const selectedProject = selectedProjects[0];

  // The new experience is enabled by default for Laravel projects
  const defaultValue = Boolean(
    selectedProject && selectedProject.platform === 'php-laravel'
  );

  const isEnabled = Boolean(
    hasLaravelInsightsFeature(organization) &&
      isSingleProject &&
      selectedProject &&
      (user.options.prefersSpecializedProjectOverview[selectedProject.id] ?? defaultValue)
  );

  const {mutate: mutateUserOptions} = useMutateUserOptions();

  const setIsEnabled = useCallback(
    (enabled: boolean) => {
      if (
        !isSingleProject ||
        !selectedProject ||
        !hasLaravelInsightsFeature(organization)
      ) {
        return;
      }

      mutateUserOptions({
        prefersSpecializedProjectOverview: {
          ...user.options.prefersSpecializedProjectOverview,
          [selectedProject.id]: enabled,
        },
      });
    },
    [
      mutateUserOptions,
      selectedProject,
      isSingleProject,
      user.options.prefersSpecializedProjectOverview,
      organization,
    ]
  );

  return [isEnabled, setIsEnabled] as const;
}
