import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useOrganizationReleases() {
  const location = useLocation();
  const organization = useOrganization();

  const locationWithoutWidth = {
    ...location,
    query: {
      ...location.query,
      width_health_table: undefined,
      width_adoption_table: undefined,
    },
  };

  const {data, isError, isPending, getResponseHeader} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          ...locationWithoutWidth.query,
          adoptionStages: 1,
          health: 1,
          per_page: 10,
        },
      },
    ],
    {staleTime: 0}
  );

  const releaseData =
    isPending || !data
      ? []
      : data.map((release, index, releases) => {
          const projSlug = release.projects[0]?.slug;

          const currentDate = new Date(release.dateCreated);
          const previousDate =
            index < releases.length - 1
              ? new Date(releases[index + 1]?.dateCreated ?? 0)
              : null;

          const lifespan = previousDate
            ? Math.floor(currentDate.getTime() - previousDate.getTime())
            : undefined;

          return {
            release: release.shortVersion ?? release.version,
            date: release.dateCreated,
            stage: projSlug ? release.adoptionStages?.[projSlug]?.stage ?? '' : '',
            crash_free_sessions: release.projects[0]?.healthData?.crashFreeSessions ?? 0,
            sessions: release.projects[0]?.healthData?.totalSessions ?? 0,
            error_count: release.projects[0]?.newGroups ?? 0,
            project_id: release.projects[0]?.id ?? 0,
            adoption: release.projects[0]?.healthData?.adoption ?? 0,
            lifespan,
          };
        });

  return {
    releaseData,
    isLoading: isPending,
    isError,
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
