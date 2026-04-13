import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type SampleRow = {
  event_id: string;
  group_id: string | null;
  timestamp: string;
  title: string;
};

interface SamplesResult {
  data: SampleRow[];
}

interface SampleEvent {
  eventId: string;
  groupId: string | null;
  timestamp: string;
  title: string;
}

interface SampleEventsResult {
  events: SampleEvent[];
  isError: boolean;
  isLoading: boolean;
}

interface Options {
  project: Project;
}

export function useSampleEvents({project}: Options): SampleEventsResult {
  const organization = useOrganization();

  const {data, isLoading, isError} = useApiQuery<SamplesResult>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          dataset: 'processing_errors',
          field: ['title', 'event_id', 'group_id', 'timestamp'],
          sort: '-timestamp',
          per_page: 5,
          statsPeriod: '30d',
          project: project.id,
          referrer: 'api.issues.sourcemap-configuration.impact-samples',
        },
      },
    ],
    {staleTime: 60_000}
  );

  const rows = data?.data ?? [];
  const events = rows.map((row: SampleRow) => ({
    title: row.title,
    eventId: row.event_id,
    groupId: row.group_id,
    timestamp: row.timestamp,
  }));

  return {events, isLoading, isError};
}
