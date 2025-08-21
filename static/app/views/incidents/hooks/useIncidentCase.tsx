import {useApiQuery} from 'sentry/utils/queryClient';
import type {IncidentCase} from 'sentry/views/incidents/types';

export function useIncidentCase({
  organizationSlug,
  caseId,
}: {
  organizationSlug: string;
  caseId?: string;
}) {
  const {
    data: incidentCase,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentCase>(
    [`/organizations/${organizationSlug}/incident-cases/${caseId}/`],
    {
      staleTime: 30000,
      enabled: !!caseId,
    }
  );

  return {
    isLoading,
    error,
    refetch,
    incidentCase,
  };
}
