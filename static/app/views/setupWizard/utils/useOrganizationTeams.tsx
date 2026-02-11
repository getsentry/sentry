import type {Team} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationTeams({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  return useQuery({
    queryKey: [
      getApiUrl(`/organizations/$organizationIdOrSlug/teams/`, {
        path: {organizationIdOrSlug: organization?.slug!},
      }),
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
