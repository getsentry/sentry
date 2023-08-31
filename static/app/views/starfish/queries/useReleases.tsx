import {Release} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useReleases() {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments, projects} = selection;

  return useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          sort: 'date',
          project: projects,
          per_page: 50,
          environment: environments,
        },
      },
    ],
    {staleTime: Infinity}
  );
}
