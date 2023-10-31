import {Release} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function useReleases(searchTerm?: string) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {environments, projects} = selection;

  const result = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          project: projects,
          per_page: 50,
          environment: environments,
          query: searchTerm,
          health: 1,
          sort: 'sessions',
          flatten: 1,
        },
      },
    ],
    {staleTime: Infinity}
  );

  const releaseStats: {
    dateCreated: string;
    platform: string;
    projectSlug: string;
    'sum(session)': number | undefined;
    version: string;
  }[] =
    result.data && result.data.length
      ? result.data.map(release => {
          const releaseVersion = release.version;
          const releaseProject = release.projects[0];
          const dateCreated = release.dateCreated;

          const projectSlug = releaseProject.slug;
          const platform = releaseProject.platform;
          const sessionCount = releaseProject.healthData?.totalSessions;
          return {
            projectSlug,
            'sum(session)': sessionCount,
            platform,
            dateCreated,
            version: releaseVersion,
          };
        })
      : [];

  return {
    ...result,
    data: releaseStats,
  };
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
