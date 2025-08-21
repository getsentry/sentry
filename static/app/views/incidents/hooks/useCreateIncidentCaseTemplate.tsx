import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentCaseTemplate} from 'sentry/views/incidents/types';

export function useCreateIncidentCaseTemplate({
  organizationSlug,
  onSuccess,
}: {
  organizationSlug: string;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
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
    onSuccess: template => {
      addSuccessMessage(t('Incident Management Configured!'));
      setApiQueryData<IncidentCaseTemplate>(
        queryClient,
        [`/organizations/${organizationSlug}/incident-case-templates/`],
        () => template
      );
      onSuccess?.();
    },
  });

  return {createMutation};
}
