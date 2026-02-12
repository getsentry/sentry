import type {Group} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useRecentIssues({projectId}: {projectId: string | undefined}) {
  const organization = useOrganization();
  const location = useLocation();

  const locationQuery = {
    ...location,
    query: {
      ...location.query,
      query: undefined,
      width: undefined,
      cursor: undefined,
    },
  };

  // hardcode 14d since the API does not support all statsPeriods
  const {data: recentIssues, isPending} = useApiQuery<Group[]>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/', {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectId!,
        },
      }),
      {query: {...locationQuery.query, statsPeriod: '14d', limit: 2}},
    ],
    {staleTime: 0}
  );

  return {recentIssues, isPending};
}
