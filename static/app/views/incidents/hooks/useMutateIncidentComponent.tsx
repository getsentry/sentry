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

export function useMutateIncidentComponent({
  organizationSlug,
  componentId,
}: {
  componentId: number;
  organizationSlug: string;
}) {
  const queryClient = useQueryClient();
  const updateMutation = useMutation<
    IncidentComponent,
    RequestError,
    Partial<IncidentComponent>
  >({
    mutationFn: data =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-components/${componentId}/`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => addSuccessMessage(t('Component Updated')),
  });

  const deleteMutation = useMutation<IncidentComponent, RequestError, void>({
    mutationFn: () =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/incident-components/${componentId}/`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      addSuccessMessage(t('Component Deleted'));
      setApiQueryData<IncidentComponent[]>(
        queryClient,
        [`/organizations/${organizationSlug}/incident-components/`],
        existingData => existingData?.filter(component => component.id !== componentId)
      );
    },
  });

  return {updateMutation, deleteMutation};
}
