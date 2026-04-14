import {useQuery} from '@tanstack/react-query';

import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type SampleEvent = {
  event_id: string;
  group_id: string | null;
  timestamp: string;
  title: string;
};

interface SamplesResult {
  data: SampleEvent[];
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

  const {data, isLoading, isError} = useQuery(
    apiOptions.as<SamplesResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: 'processing_errors',
        field: ['title', 'event_id', 'group_id', 'timestamp'],
        sort: '-timestamp',
        per_page: 5,
        statsPeriod: '30d',
        project: project.id,
        referrer: 'api.issues.sourcemap-configuration.impact-samples',
      },
      staleTime: 60_000,
    })
  );

  return {events: data?.data ?? [], isLoading, isError};
}
