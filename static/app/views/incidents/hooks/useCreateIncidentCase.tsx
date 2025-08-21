import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCase} from 'sentry/views/incidents/types';

export function useCreateIncidentCase({
  organizationSlug,
  onSuccess,
}: {
  organizationSlug: string;
  onSuccess?: (result: IncidentCase) => void;
}) {
  const createMutation = useMutation<IncidentCase, RequestError, Partial<IncidentCase>>({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-cases/`,
        method: 'POST',
        data,
      }),
    onSuccess: (result: IncidentCase) => {
      addSuccessMessage(t('Incident Created'));
      onSuccess?.(result);
    },
  });

  return {createMutation};
}
