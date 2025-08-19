import {useApiQuery} from 'sentry/utils/queryClient';
import type {IncidentComponent} from 'sentry/views/incidents/types';

export function useIncidentComponent({
  organizationSlug,
  componentId,
}: {
  componentId: number;
  organizationSlug: string;
}) {
  const {
    data: incidentComponent,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentComponent>(
    [`/organizations/${organizationSlug}/incident-components/${componentId}/`],
    {staleTime: 30000}
  );

  return {
    isLoading,
    error,
    refetch,
    incidentComponent,
  };
}
