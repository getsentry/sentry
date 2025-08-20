import {useApiQuery} from 'sentry/utils/queryClient';
import type {IncidentComponent} from 'sentry/views/incidents/types';

export function useIncidentComponents({organizationSlug}: {organizationSlug: string}) {
  const {
    data: incidentComponents,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentComponent[]>(
    [`/organizations/${organizationSlug}/incident-components/`],
    {staleTime: 0}
  );

  return {
    incidentComponents: incidentComponents || [],
    isLoading,
    error,
    refetch,
  };
}
