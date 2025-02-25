import type {Release} from 'sentry/types/release';
import {FieldKey} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export default function useOrganizationReleases({
  tableType,
  filters,
}: {
  filters: string[];
  tableType: 'health' | 'adoption';
}) {
  const location = useLocation();
  const organization = useOrganization();

  const locationWithoutWidth = {
    ...location,
    query: {
      ...location.query,
      width_health_table: undefined,
      width_adoption_table: undefined,
      cursor_health_table: undefined,
      cursor_adoption_table: undefined,
    },
  };

  let finalized;
  const hasFinalized = filters.includes('Finalized');
  const hasNotFinalized = filters.includes('Not Finalized');

  if (hasFinalized && !hasNotFinalized) {
    finalized = 'finalized';
  } else if (!hasFinalized && hasNotFinalized) {
    finalized = 'not finalized';
  } else {
    // if both or neither are selected, it's the same as not selecting any
    finalized = undefined;
  }

  let status;
  const hasActive = filters.includes('Active');
  const hasArchived = filters.includes('Archived');

  if (hasActive && !hasArchived) {
    status = 'open';
  } else if (!hasActive && hasArchived) {
    status = 'archived';
  } else {
    // if both or neither are selected, it's the same as not selecting any
    status = undefined;
  }

  const stages: string[] = [];
  if (filters.includes('Adopted')) {
    stages.push('adopted');
  }
  if (filters.includes('Replaced')) {
    stages.push('replaced');
  }
  if (filters.includes('Low Adoption')) {
    stages.push('low_adoption');
  }
  const stage = stages.length
    ? `${FieldKey.RELEASE_STAGE}:[${stages.join(',')}]`
    : undefined;

  const {data, isError, isPending, getResponseHeader} = useApiQuery<Release[]>(
    [
      `/organizations/${organization.slug}/releases/`,
      {
        query: {
          query: stage,
          ...locationWithoutWidth.query,
          adoptionStages: 1,
          health: 1,
          per_page: 10,
          cursor:
            tableType === 'health'
              ? location.query.cursor_health_table
              : location.query.cursor_adoption_table,
          status,
        },
      },
    ],
    {staleTime: 0}
  );

  const releaseData =
    isPending || !data
      ? []
      : data
          // need to filter since the endpoint does not support querying by finalized status
          .filter(release => {
            if (finalized === 'finalized') {
              return !!release.dateReleased;
            }
            if (finalized === 'not finalized') {
              return !release.dateReleased;
            }
            return true;
          })
          .map((release, index, releases) => {
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
              adoption_stage: projSlug
                ? release.adoptionStages?.[projSlug]?.stage ?? ''
                : '',
              crash_free_sessions:
                release.projects[0]?.healthData?.crashFreeSessions ?? 0,
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
