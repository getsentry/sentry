import {pageFiltersToQueryParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Release} from 'sentry/types/release';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {FieldKey} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function useOrganizationReleases({
  filters,
  pageFilters,
}: {
  filters: string[];
  pageFilters?: PageFilters;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {selection: defaultPageFilters} = usePageFilters();

  let finalizedQuery: string | undefined;
  const hasFinalized = filters.includes('Finalized');
  const hasNotFinalized = filters.includes('Not Finalized');

  if (hasFinalized && !hasNotFinalized) {
    finalizedQuery = 'finalized:true';
  } else if (!hasFinalized && hasNotFinalized) {
    finalizedQuery = 'finalized:false';
  } else {
    // if both or neither are selected, it's the same as not selecting any
    finalizedQuery = undefined;
  }

  let status: 'open' | 'archived' | undefined;
  const hasOpen = filters.includes('Open');
  const hasArchived = filters.includes('Archived');

  if (hasOpen && !hasArchived) {
    status = 'open';
  } else if (!hasOpen && hasArchived) {
    status = 'archived';
  } else {
    // if both or neither are selected, it's the same as not selecting any
    status = undefined;
  }

  const stageMap = {
    Adopted: 'adopted',
    Replaced: 'replaced',
    'Low Adoption': 'low_adoption',
  };

  const stages = Object.entries(stageMap)
    .filter(([filter]) => filters.includes(filter))
    .map(([, value]) => value);

  const stage = stages.length
    ? `${FieldKey.RELEASE_STAGE}:[${stages.join(',')}]`
    : undefined;

  const queryString = [stage, finalizedQuery, location.query.query]
    .filter(Boolean)
    .join(' ')
    .trim();

  const {data, isError, isPending, getResponseHeader} = useApiQuery<Release[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/releases/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...pageFiltersToQueryParams(pageFilters || defaultPageFilters),
          query: queryString,
          adoptionStages: 1,
          health: 1,
          per_page: 10,
          status,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const releaseData =
    isPending || !data
      ? []
      : data.map(release => {
          const projSlug = release.projects[0]?.slug;

          return {
            project: release.projects[0]!,
            release: release.shortVersion ?? release.version,
            date: release.dateCreated,
            adoption_stage: projSlug
              ? (release.adoptionStages?.[projSlug]?.stage ?? '')
              : '',
            crash_free_sessions: release.projects[0]?.healthData?.crashFreeSessions ?? 0,
            sessions: release.projects[0]?.healthData?.totalSessions ?? 0,
            error_count: release.projects[0]?.newGroups ?? 0,
            project_id: release.projects[0]?.id ?? 0,
            adoption: release.projects[0]?.healthData?.adoption ?? 0,
            status: release.status,
          };
        });

  return {
    releaseData,
    isLoading: isPending,
    isError,
    pageLinks: getResponseHeader?.('Link') ?? undefined,
  };
}
