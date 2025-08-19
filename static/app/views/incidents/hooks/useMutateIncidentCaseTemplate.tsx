import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function useMutateIncidentCaseTemplate({
  organizationSlug,
  templateId,
}: {
  organizationSlug: string;
  templateId: number;
}) {
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
    onSuccess: () => addSuccessMessage(t('Template Updated')),
  });

  const deleteMutation = useMutation<IncidentCaseTemplate, RequestError, void>({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-case-templates/${templateId}/`,
        method: 'DELETE',
      }),
    onSuccess: () => addSuccessMessage(t('Template Deleted')),
  });

  return {updateMutation, deleteMutation};
}
