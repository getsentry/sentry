import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {
  fetchMutation,
  setApiQueryData,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import type {IncidentComponent} from 'sentry/views/incidents/types';

export function useCreateIncidentComponent({
  organizationSlug,
}: {
  organizationSlug: string;
}) {
  const queryClient = useQueryClient();
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
    onSuccess: (incidentComponent: IncidentComponent) => {
      addSuccessMessage(t('Component Created'));
      setApiQueryData<IncidentComponent[]>(
        queryClient,
        [`/organizations/${organizationSlug}/incident-components/`],
        existingData => [...(existingData ?? []), incidentComponent]
      );
    },
  });

  return {createMutation};
}
