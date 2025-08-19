import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentComponent} from 'sentry/views/incidents/types';

export function useCreateIncidentComponent({
  organizationSlug,
}: {
  organizationSlug: string;
}) {
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

  return {createMutation};
}
