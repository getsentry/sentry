import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function useIncidentCaseTemplates({organizationSlug}: {organizationSlug: string}) {
  const {
    data: incidentCaseTemplates,
    isLoading,
    error,
    refetch,
  } = useApiQuery<IncidentCaseTemplate[]>(
    [`/organizations/${organizationSlug}/incident-case-templates/`],
    {staleTime: 30000}
  );

  const createMutation = useMutation<
    IncidentCaseTemplate,
    RequestError,
    Partial<IncidentCaseTemplate>
  >({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-case-templates/`,
        method: 'POST',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Template Created')),
  });

  return {
    incidentCaseTemplates: incidentCaseTemplates || [],
    isLoading,
    error,
    refetch,
    createMutation,
  };
}
