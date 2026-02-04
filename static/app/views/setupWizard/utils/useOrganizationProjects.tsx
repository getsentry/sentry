import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import type {OrganizationWithRegion} from 'sentry/views/setupWizard/types';

export function useOrganizationProjects({
  organization,
  query,
}: {
  organization?: OrganizationWithRegion;
  query?: string;
}) {
  return useQuery({
    queryKey: [
      getApiUrl(`/organizations/$organizationIdOrSlug/projects/`, {
        path: {organizationIdOrSlug: organization?.slug!},
      }),
      {
        host: organization?.region.url,
        query: {
          query,
        },
      },
    ] satisfies ApiQueryKey,
    queryFn: context => {
      return fetchDataQuery<Project[]>(context).then(result => result[0]);
    },
    enabled: !!organization,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
