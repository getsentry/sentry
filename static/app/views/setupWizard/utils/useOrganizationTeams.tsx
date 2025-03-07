import type {Team} from 'sentry/types/organization';
import {useQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationTeams({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  const api = useApi();
  const queryParams = {
    host: organization?.region.url,
  };

  return useQuery<Team[], RequestError>({
    queryKey: [`/organizations/${organization?.slug}/teams/`, queryParams],
    queryFn: () => {
      return api.requestPromise(
        `/organizations/${organization?.slug}/user-teams/`,
        queryParams
      );
    },
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
