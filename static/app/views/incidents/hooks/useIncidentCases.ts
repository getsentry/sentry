import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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

  const createMutation = useMutation<IncidentCase, RequestError, Partial<IncidentCase>>({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-cases/`,
        method: 'POST',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Incident Created')),
  });

  return {
    incidentCases: incidentCases || [],
    isLoading,
    error,
    refetch,
    createMutation,
  };
}
