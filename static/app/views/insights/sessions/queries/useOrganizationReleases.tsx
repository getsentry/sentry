import type {Release} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useOrganizationReleases() {
  const location = useLocation();
  const organization = useOrganization();
  const {data, isError, isPending, getResponseHeader} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          ...location.query,
          adoptionStages: 1,
          health: 1,
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
          };
        });
  return {
    releaseData,
    isLoading: isPending,
    isError,
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
