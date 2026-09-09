import {useMutation} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApi} from 'sentry/utils/useApi';
import type {OrganizationSummaryWithLocality} from 'sentry/views/setupWizard/types';
export function useCreateProjectFromWizard() {
  const api = useApi();
  return useMutation({
    mutationFn: (params: {
      name: string;
      organization: OrganizationSummaryWithLocality;
      platform: string;
      team: string | null;
    }): Promise<Project> => {
      return api.requestPromise(
        params.team
          ? getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/projects/', {
              path: {
                organizationIdOrSlug: params.organization.slug,
                teamIdOrSlug: params.team,
              },
            })
          : getApiUrl('/organizations/$organizationIdOrSlug/projects/', {
              path: {organizationIdOrSlug: params.organization.slug},
            }),
        {
          method: 'POST',
          host: params.organization.region.url,
          data: {
            name: params.name,
            platform: params.platform,
            default_rules: true,
            origin: 'wizard-ui',
          },
        }
      );
    },
    onSuccess: (response, params) => {
      ProjectsStore.onCreateSuccess(response, params.organization.slug);
    },
    onError: () => {
      addErrorMessage(t('Failed to create project! Please try again'));
    },
  });
}
