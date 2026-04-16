import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {allDetectorListsQueryKey} from 'sentry/views/detectors/hooks';

export function useDeleteDetectorMutation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<void, RequestError, string>({
    mutationFn: (detectorId: string) =>
      api.requestPromise(`/organizations/${org.slug}/detectors/${detectorId}/`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
      addSuccessMessage(t('Monitor deleted.'));
    },
    onError: error => {
      addErrorMessage(t('Unable to delete monitor: %s', error.message));
    },
  });
}
