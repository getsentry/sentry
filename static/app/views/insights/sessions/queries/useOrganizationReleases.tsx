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

  if (isPending) {
    return {
      releaseData: [],
      isLoading: true,
      isError,
      pageLinks: getResponseHeader?.('Link') ?? undefined,
    };
  }

  if (!data && !isPending) {
    return {
      releaseData: [],
      isLoading: false,
      isError,
      pageLinks: getResponseHeader?.('Link') ?? undefined,
    };
  }

  const releaseData = data.map(release => {
    const projSlug = release.projects[0]?.slug;

    return {
      version: release.shortVersion ?? release.version,
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
