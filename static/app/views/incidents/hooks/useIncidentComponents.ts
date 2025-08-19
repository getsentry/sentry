import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentComponent} from 'sentry/views/incidents/types';

export function useIncidentComponents({organizationSlug}: {organizationSlug: string}) {
  const {
    data: incidentComponents,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentComponent[]>(
    [`/organizations/${organizationSlug}/incident-components/`],
    {staleTime: 30000}
  );

  const createMutation = useMutation<
    IncidentComponent,
    RequestError,
    Partial<IncidentComponent>
  >({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-components/`,
        method: 'POST',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Component Created')),
  });

  return {
    incidentComponents: incidentComponents || [],
    isLoading,
    error,
    refetch,
    createMutation,
  };
}
