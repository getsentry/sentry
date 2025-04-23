import {useCallback} from 'react';

import type {Organization} from 'sentry/types/organization';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';

export function hasNextJsInsightsFeature(organization: Organization) {
  return organization.features.includes('nextjs-insights');
}

export function useIsNextJsInsightsAvailable() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const selectedProjects = getSelectedProjectList(selection.projects, projects);

  const isOnlyNextJsSelected = selectedProjects.every(
    project => project.platform === 'javascript-nextjs'
  );

  return hasNextJsInsightsFeature(organization) && isOnlyNextJsSelected;
}

export function useIsNextJsInsightsEnabled() {
  const organization = useOrganization();
  const user = useUser();
  const isAvailable = useIsNextJsInsightsAvailable();

  const isEnabled = Boolean(
    isAvailable && (user.options.prefersNextjsInsightsOverview ?? true)
  );

  const {mutate: mutateUserOptions} = useMutateUserOptions();

  const setIsEnabled = useCallback(
    (enabled: boolean) => {
      if (!hasNextJsInsightsFeature(organization)) {
        return;
      }

      mutateUserOptions({
        prefersNextjsInsightsOverview: enabled,
      });
    },
    [mutateUserOptions, organization]
  );

  return [isEnabled, setIsEnabled] as const;
}
