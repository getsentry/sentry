import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface CountResult {
  data: Array<{'count_unique(event_id)': number}>;
}

interface ImpactedEventsCount {
  count: number | null;
  isError: boolean;
  isLoading: boolean;
}

interface Options {
  project: Project;
}

export function useImpactedEventsCount({project}: Options): ImpactedEventsCount {
  const organization = useOrganization();

  const {data, isLoading, isError} = useApiQuery<CountResult>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/events/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          dataset: 'processing_errors',
          field: ['count_unique(event_id)'],
          statsPeriod: '30d',
          project: project.id,
          referrer: 'api.issues.sourcemap-configuration.impact-events-count',
        },
      },
    ],
    {staleTime: 60_000}
  );

  return {
    count: data?.data?.[0]?.['count_unique(event_id)'] ?? null,
    isLoading,
    isError,
  };
}
