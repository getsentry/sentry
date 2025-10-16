import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

/** Bulk delete detectors */
export function useDeleteDetectorsMutation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<
    void,
    RequestError,
    {ids?: string[]; projects?: number[]; query?: string}
  >({
    mutationFn: params => {
      return api.requestPromise(`/organizations/${org.slug}/detectors/`, {
        method: 'DELETE',
        query: {
          id: params.ids,
          query: params.query,
          project: params.projects,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${org.slug}/detectors/`],
      });
      addSuccessMessage(t('Monitors deleted'));
    },
    onError: () => {
      addErrorMessage(t('Unable to delete monitors'));
    },
  });
}
