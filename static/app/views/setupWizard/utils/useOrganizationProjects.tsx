import type {Project} from 'sentry/types/project';
import {useQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationProjects({
  organization,
  query,
}: {
  organization?: OrganizationWithRegion;
  query?: string;
}) {
  const api = useApi();

  return useQuery<Project[], RequestError>({
    queryKey: [`/organizations/${organization?.slug}/projects/`, {query}],
    queryFn: () => {
      return api.requestPromise(`/organizations/${organization?.slug}/projects/`, {
        host: organization?.region.url,
        query: {
          query,
        },
      });
    },
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
