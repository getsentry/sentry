import {useQuery} from '@tanstack/react-query';

import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SOURCE_MAP_ERROR_TYPES_QUERY} from 'sentry/views/issueDetails/configurationIssues/sourceMapIssues/constants';

type ReleaseRow = {release: string} & {'count_unique(event_id)': number};

interface ReleasesResult {
  data: ReleaseRow[];
}

interface AffectedRelease {
  count: number;
  release: string;
}

interface AffectedReleasesResult {
  isError: boolean;
  isLoading: boolean;
  releases: AffectedRelease[];
}

interface Options {
  project: Project;
}

export function useAffectedReleases({project}: Options): AffectedReleasesResult {
  const organization = useOrganization();

  const {data, isLoading, isError} = useQuery(
    apiOptions.as<ReleasesResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: 'processing_errors',
        field: ['release', 'count_unique(event_id)'],
        query: `${SOURCE_MAP_ERROR_TYPES_QUERY} has:release`,
        sort: '-count_unique(event_id)',
        per_page: 5,
        statsPeriod: '30d',
        project: project.id,
        referrer: 'api.issues.sourcemap-configuration.impact-releases',
      },
      staleTime: 60_000,
    })
  );

  const rows = data?.data ?? [];
  const releases = rows.map((row: ReleaseRow) => ({
    release: row.release,
    count: row['count_unique(event_id)'],
  }));

  return {releases, isLoading, isError};
}
