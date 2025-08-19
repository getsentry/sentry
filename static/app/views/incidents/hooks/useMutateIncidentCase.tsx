import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCase} from 'sentry/views/incidents/types';

export function useMutateIncidentCase({
  organizationSlug,
  caseId,
}: {
  caseId: number;
  organizationSlug: string;
}) {
  const updateMutation = useMutation<IncidentCase, RequestError, Partial<IncidentCase>>({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-cases/${caseId}/`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Incident Updated')),
  });

  const deleteMutation = useMutation<IncidentCase, RequestError, void>({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-cases/${caseId}/`,
        method: 'DELETE',
      }),
    onSuccess: () => addSuccessMessage(t('Incident Deleted')),
  });

  return {updateMutation, deleteMutation};
}
