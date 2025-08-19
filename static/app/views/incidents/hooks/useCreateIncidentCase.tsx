import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCase} from 'sentry/views/incidents/types';

export function useCreateIncidentCase({organizationSlug}: {organizationSlug: string}) {
  const createMutation = useMutation<IncidentCase, RequestError, Partial<IncidentCase>>({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-cases/`,
        method: 'POST',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Incident Created')),
  });

  return {createMutation};
}
