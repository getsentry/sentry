import type {Release} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

/**
 * Hook to fetch releases for dashboard filtering.
 *
 * This is similar to the Insights version (static/app/views/insights/common/queries/useReleases.tsx)
 * but simplified for general dashboard use - it doesn't include the mobile-specific metrics queries
 * that the Insights version uses for event counts.
 *
 * @tested_via ReleasesSelectControl component tests (releasesSelectControl.spec.tsx)
 */
export function useReleases(searchTerm?: string) {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const {environments, projects} = selection;

  const queryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/releases/', {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {
      query: {
        project: projects,
        per_page: 50,
        environment: environments,
        query: searchTerm,
        sort: 'date',
      },
    },
  ];

  return useApiQuery<Release[]>(queryKey, {
    staleTime: Infinity,
    enabled: isReady,
    retry: false,
  });
}
