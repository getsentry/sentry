import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useCreateProjectFromWizard() {
  const api = useApi();
  return useMutation({
    mutationFn: (params: {
      name: string;
      organization: OrganizationWithRegion;
      platform: string;
      team: string | null;
    }): Promise<Project> => {
      return api.requestPromise(
        params.team
          ? `/teams/${params.organization.slug}/${params.team}/projects/`
          : `/organizations/${params.organization.slug}/experimental/projects/`,
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
  });
}
