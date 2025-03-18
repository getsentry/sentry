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

  const isOnlyLaravelSelected = selectedProjects.every(
    project => project.platform === 'php-laravel'
  );

  return hasLaravelInsightsFeature(organization) && isOnlyLaravelSelected;
}

// It started out as a dictionary of project IDs, but as we now want a global toggle we use a special key
// to represent all projects. (This user option is a temporary feature and will be removed in the future.)
const ALL_PROJECTS_KEY = 'all';

export function useIsLaravelInsightsEnabled() {
  const organization = useOrganization();
  const user = useUser();
  const isAvailable = useIsLaravelInsightsAvailable();

  const isEnabled = Boolean(
    isAvailable &&
      (user.options.prefersSpecializedProjectOverview[ALL_PROJECTS_KEY] ?? true)
  );

  const {mutate: mutateUserOptions} = useMutateUserOptions();

  const setIsEnabled = useCallback(
    (enabled: boolean) => {
      if (!hasLaravelInsightsFeature(organization)) {
        return;
      }

      mutateUserOptions({
        prefersSpecializedProjectOverview: {
          [ALL_PROJECTS_KEY]: enabled,
        },
      });
    },
    [mutateUserOptions, organization]
  );

  return [isEnabled, setIsEnabled] as const;
}
