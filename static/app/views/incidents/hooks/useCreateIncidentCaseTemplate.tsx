import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function useCreateIncidentCaseTemplate({
  organizationSlug,
  onSuccess,
}: {
  organizationSlug: string;
  onSuccess?: () => void;
}) {
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
    onSuccess: () => {
      addSuccessMessage(t('Incident Management Configured!'));
      onSuccess?.();
    },
  });

  return {createMutation};
}
