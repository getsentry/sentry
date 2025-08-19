import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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

  const updateMutation = useMutation<
    IncidentComponent,
    RequestError,
    Partial<IncidentComponent>
  >({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-components/${componentId}/`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Component Updated')),
  });

  const deleteMutation = useMutation<IncidentComponent, RequestError, void>({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-components/${componentId}/`,
        method: 'DELETE',
      }),
    onSuccess: () => addSuccessMessage(t('Component Deleted')),
  });

  return {
    isLoading,
    error,
    refetch,
    incidentComponent,
    updateMutation,
    deleteMutation,
  };
}
