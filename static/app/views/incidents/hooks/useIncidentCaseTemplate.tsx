import {useApiQuery} from 'sentry/utils/queryClient';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function useIncidentCaseTemplate({
  organizationSlug,
  templateId,
}: {
  organizationSlug: string;
  templateId: number;
}) {
  const {
    data: incidentCaseTemplate,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentCaseTemplate>(
    [`/organizations/${organizationSlug}/incident-case-templates/${templateId}/`],
    {staleTime: 30000}
  );

  return {
    isLoading,
    error,
    refetch,
    incidentCaseTemplate,
  };
}
