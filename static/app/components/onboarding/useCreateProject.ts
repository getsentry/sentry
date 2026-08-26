import {useMutation} from '@tanstack/react-query';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
interface Variables {
  platform: OnboardingSelectedSDK;
  default_rules?: boolean;
  firstTeamSlug?: string;
  name?: string;
}

export function useCreateProject() {
  const api = useApi({persistInFlight: true});
  const organization = useOrganization();

  return useMutation<Project, RequestError, Variables>({
    mutationFn: ({firstTeamSlug, name, platform, default_rules}) => {
      return api.requestPromise(
        firstTeamSlug
          ? getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/projects/', {
              path: {
                organizationIdOrSlug: organization.slug,
                teamIdOrSlug: firstTeamSlug,
              },
            })
          : getApiUrl('/organizations/$organizationIdOrSlug/projects/', {
              path: {organizationIdOrSlug: organization.slug},
            }),
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
