import {useQuery} from '@tanstack/react-query';

import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SOURCE_MAP_ERROR_TYPES_QUERY} from 'sentry/views/issueDetails/configurationIssues/sourceMapIssues/constants';

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

  const {data, isLoading, isError} = useQuery(
    apiOptions.as<CountResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: 'processing_errors',
        field: ['count_unique(event_id)'],
        query: SOURCE_MAP_ERROR_TYPES_QUERY,
        statsPeriod: '30d',
        project: project.id,
        referrer: 'api.issues.sourcemap-configuration.impact-events-count',
      },
      staleTime: 60_000,
    })
  );

  return {
    count: data?.data?.[0]?.['count_unique(event_id)'] ?? null,
    isLoading,
    isError,
  };
}
