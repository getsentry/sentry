import {useApiQuery} from 'sentry/utils/queryClient';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function useIncidentCaseTemplates({organizationSlug}: {organizationSlug: string}) {
  const {
    data: incidentCaseTemplate,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentCaseTemplate>(
    [`/organizations/${organizationSlug}/incident-case-templates/`],
    {staleTime: 30000}
  );

  return {
    incidentCaseTemplate,
    isLoading,
    error,
    refetch,
  };
}
