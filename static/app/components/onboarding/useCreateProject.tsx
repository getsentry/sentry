import * as Sentry from '@sentry/react';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {useIsMutating, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const MUTATION_KEY = 'create-project';

interface Variables {
  platform: OnboardingSelectedSDK;
  default_rules?: boolean;
  firstTeamSlug?: string;
  name?: string;
}

export function useCreateProject() {
  const api = useApi();
  const organization = useOrganization();

  return useMutation<Project, RequestError, Variables>({
    mutationKey: [MUTATION_KEY],
    mutationFn: ({firstTeamSlug, name, platform, default_rules}) => {
      // A default team should always be created for a new organization.
      // If teams are loaded but no first team is found, fallback to the experimental project.
      if (!firstTeamSlug) {
        Sentry.captureException('No team slug found for new org during onboarding');
      }
      return api.requestPromise(
        firstTeamSlug
          ? `/teams/${organization.slug}/${firstTeamSlug}/projects/`
          : `/organizations/${organization.slug}/experimental/projects/`,
        {
          method: 'POST',
          data: {
            platform: platform.key,
            name,
            default_rules: default_rules ?? true,
            origin: 'ui',
          },
        }
      );
    },
    onSuccess: response => {
      ProjectsStore.onCreateSuccess(response, organization.slug);
    },
  });
}

export function useIsCreatingProject() {
  return Boolean(useIsMutating({mutationKey: [MUTATION_KEY]}));
}
