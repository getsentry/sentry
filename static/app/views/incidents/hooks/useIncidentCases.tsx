import {useApiQuery} from 'sentry/utils/queryClient';
import type {IncidentCase} from 'sentry/views/incidents/types';

export function useIncidentCases({organizationSlug}: {organizationSlug: string}) {
  const {
    data: incidentCases,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentCase[]>(
    [`/organizations/${organizationSlug}/incident-cases/`],
    {staleTime: 30000}
  );

  return {
    incidentCases: incidentCases || [],
    isLoading,
    error,
    refetch,
  };
}
