import {Release} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
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
          per_page: 20,
          environment: environments,
        },
      },
    ],
    {staleTime: Infinity}
  );
}

export function useReleaseSelection() {
  const location = useLocation();

  const {data: releases, isLoading} = useReleases();
  const primaryRelease =
    decodeScalar(location.query.primaryRelease) ?? releases?.[0]?.version ?? undefined;

  const secondaryRelease =
    decodeScalar(location.query.secondaryRelease) ??
    (releases && releases.length > 1 ? releases?.[1]?.version : undefined);

  return {primaryRelease, secondaryRelease, isLoading};
}

export function useReleaseStats() {
  const {data: releases, isLoading} = useReleases();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments, projects} = selection;

  const {data} = useApiQuery<any>(
    [
      `/organizations/${organization.slug}/sessions`,
      {
        query: {
          project: projects,
          environment: environments,
        },
      },
    ],
    {staleTime: Infinity}
  );
  return {
    releases,
    isLoading,
  };
}
