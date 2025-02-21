import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useOrganizationReleases() {
  const location = useLocation();
  const organization = useOrganization();

  const locationWithoutWidth = {
    ...location,
    query: {...location.query, width: undefined},
  };

  const {data, isError, isPending, getResponseHeader} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          ...locationWithoutWidth.query,
          adoptionStages: 1,
          health: 1,
          per_page: 25,
        },
      },
    ],
    {staleTime: 0}
  );

  const releaseData =
    isPending || !data
      ? []
      : data.map(release => {
          const projSlug = release.projects[0]?.slug;
          return {
            release: release.shortVersion ?? release.version,
            date: release.dateCreated,
            stage: projSlug ? release.adoptionStages?.[projSlug]?.stage ?? '' : '',
            crash_free_sessions: release.projects[0]?.healthData?.crashFreeSessions ?? 0,
            sessions: release.projects[0]?.healthData?.totalSessions ?? 0,
            error_count: release.projects[0]?.newGroups ?? 0,
            project_id: release.projects[0]?.id ?? 0,
          };
        });

  return {
    releaseData,
    isLoading: isPending,
    isError,
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
