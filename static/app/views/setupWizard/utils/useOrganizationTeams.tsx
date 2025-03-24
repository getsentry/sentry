import type {Team} from 'sentry/types/organization';
import {type ApiQueryKey, fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationTeams({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  return useQuery({
    queryKey: [
      `/organizations/${organization?.slug}/teams/`,
      {
        host: organization?.region.url,
      },
    ] satisfies ApiQueryKey,
    queryFn: context => {
      return fetchDataQuery<Team[]>(context).then(result => result[0]);
    },
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
