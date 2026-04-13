import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

const COUNT_FIELD = 'count_unique(event_id)' as const;
const RELEASE_FIELDS = ['release', COUNT_FIELD] as const;
const SAMPLE_FIELDS = ['title', 'event_id', 'group_id', 'timestamp'] as const;

interface ProcessingErrorsCountResult {
  data: Array<Record<typeof COUNT_FIELD, number>>;
}

type ReleaseRow = {release: string} & Record<typeof COUNT_FIELD, number>;

interface ProcessingErrorsReleasesResult {
  data: ReleaseRow[];
}

export interface ProcessingErrorsCount {
  count: number | null;
  isError: boolean;
  isLoading: boolean;
}

export interface AffectedRelease {
  count: number;
  release: string;
}

export interface SampleEvent {
  eventId: string;
  groupId: string;
  timestamp: string;
  title: string;
}

export interface SampleEventsResult {
  events: SampleEvent[];
  isError: boolean;
  isLoading: boolean;
}

export interface AffectedReleasesResult {
  isError: boolean;
  isLoading: boolean;
  releases: AffectedRelease[];
}

interface UseProcessingErrorsQueryOptions {
  projectId: string;
}

export function useProcessingErrorsQuery({
  projectId,
}: UseProcessingErrorsQueryOptions): ProcessingErrorsCount {
  const organization = useOrganization();

  const {data, isLoading, isError} = useApiQuery<ProcessingErrorsCountResult>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          dataset: 'processing_errors',
          field: [COUNT_FIELD],
          statsPeriod: '30d',
          project: projectId,
          referrer: 'api.issues.sourcemap-configuration.impact',
        },
      },
    ],
    {staleTime: 60_000}
  );

  return {
    count: data?.data?.[0]?.[COUNT_FIELD] ?? null,
    isLoading,
    isError,
  };
}

export function useAffectedReleasesQuery({
  projectId,
}: UseProcessingErrorsQueryOptions): AffectedReleasesResult {
  const organization = useOrganization();

  const {data, isLoading, isError} = useApiQuery<ProcessingErrorsReleasesResult>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          dataset: 'processing_errors',
          field: RELEASE_FIELDS,
          sort: `-${COUNT_FIELD}`,
          per_page: 5,
          statsPeriod: '30d',
          project: projectId,
          referrer: 'api.issues.sourcemap-configuration.impact-releases',
        },
      },
    ],
    {staleTime: 60_000}
  );

  const rows: ReleaseRow[] = data?.data ?? [];
  const releases: AffectedRelease[] = rows
    .filter((row: ReleaseRow) => Boolean(row.release))
    .map((row: ReleaseRow) => ({release: row.release, count: row[COUNT_FIELD]}));

  return {releases, isLoading, isError};
}

type SampleRow = {
  event_id: string;
  group_id: string;
  timestamp: string;
  title: string;
};

interface ProcessingErrorsSamplesResult {
  data: SampleRow[];
}

export function useSampleEventsQuery({
  projectId,
}: UseProcessingErrorsQueryOptions): SampleEventsResult {
  const organization = useOrganization();

  const {data, isLoading, isError} = useApiQuery<ProcessingErrorsSamplesResult>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          dataset: 'processing_errors',
          field: SAMPLE_FIELDS,
          sort: '-timestamp',
          per_page: 5,
          statsPeriod: '30d',
          project: projectId,
          referrer: 'api.issues.sourcemap-configuration.impact-samples',
        },
      },
    ],
    {staleTime: 60_000}
  );

  const rows: SampleRow[] = data?.data ?? [];
  const events: SampleEvent[] = rows.map((row: SampleRow) => ({
    title: row.title,
    eventId: row.event_id,
    groupId: row.group_id,
    timestamp: row.timestamp,
  }));

  return {events, isLoading, isError};
}
