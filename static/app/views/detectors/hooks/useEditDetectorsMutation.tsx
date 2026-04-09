import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {allDetectorListsQueryKey} from 'sentry/views/detectors/hooks';

/** Bulk update detectors. Currently supports enabling/disabling detectors. */
export function useUpdateDetectorsMutation() {
  const org = useOrganization();
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation<
    void,
    RequestError,
    {enabled: boolean; ids?: string[]; projects?: number[]; query?: string}
  >({
    mutationFn: params => {
      return api.requestPromise(`/organizations/${org.slug}/detectors/`, {
        method: 'PUT',
        data: {enabled: params.enabled},
        query: {
          id: params.ids,
          query: params.query,
          project: params.projects,
        },
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
      addSuccessMessage(
        variables.enabled ? t('Monitors enabled') : t('Monitors disabled')
      );
    },
    onError: (_, variables) => {
      addErrorMessage(
        t('Unable to %s monitors', variables.enabled ? t('enable') : t('disable'))
      );
    },
  });
}
