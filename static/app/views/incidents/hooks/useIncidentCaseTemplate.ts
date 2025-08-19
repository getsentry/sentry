import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useApiQuery, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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

  const updateMutation = useMutation<
    IncidentCaseTemplate,
    RequestError,
    Partial<IncidentCaseTemplate>
  >({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-case-templates/${templateId}/`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Incident Template Updated')),
  });

  const deleteMutation = useMutation<IncidentCaseTemplate, RequestError, void>({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-case-templates/${templateId}/`,
        method: 'DELETE',
      }),
    onSuccess: () => addSuccessMessage(t('Incident Template Deleted')),
  });

  return {
    isLoading,
    error,
    refetch,
    incidentCaseTemplate,
    updateMutation,
    deleteMutation,
  };
}
