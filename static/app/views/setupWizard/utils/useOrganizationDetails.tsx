import type {Organization} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationDetails({
  organization,
}: {
  organization?: OrganizationWithRegion;
}) {
  return useQuery({
    queryKey: [
      getApiUrl(`/organizations/$organizationIdOrSlug/`, {
        path: {organizationIdOrSlug: organization?.slug!},
      }),
      {
        host: organization?.region.url,
        query: {
          include_feature_flags: 1,
        },
      },
    ] satisfies ApiQueryKey,
    queryFn: context => fetchDataQuery<Organization>(context).then(result => result[0]),
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
