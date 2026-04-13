import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type ReleaseRow = {release: string} & {'count_unique(event_id)': number};

interface ReleasesResult {
  data: ReleaseRow[];
}

export interface AffectedRelease {
  count: number;
  release: string;
}

export interface AffectedReleasesResult {
  isError: boolean;
  isLoading: boolean;
  releases: AffectedRelease[];
}

interface Options {
  project: Project;
}

export function useAffectedReleases({project}: Options): AffectedReleasesResult {
  const organization = useOrganization();

  const {data, isLoading, isError} = useApiQuery<ReleasesResult>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          dataset: 'processing_errors',
          field: ['release', 'count_unique(event_id)'],
          sort: '-count_unique(event_id)',
          per_page: 5,
          statsPeriod: '30d',
          project: project.id,
          referrer: 'api.issues.sourcemap-configuration.impact-releases',
        },
      },
    ],
    {staleTime: 60_000}
  );

  const rows: ReleaseRow[] = data?.data ?? [];
  const releases: AffectedRelease[] = rows
    .filter((row: ReleaseRow) => Boolean(row.release))
    .map((row: ReleaseRow) => ({
      release: row.release,
      count: row['count_unique(event_id)'],
    }));

  return {releases, isLoading, isError};
}
