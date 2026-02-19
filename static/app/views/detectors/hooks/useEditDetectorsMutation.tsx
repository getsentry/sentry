import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

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
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/detectors/', {
            path: {organizationIdOrSlug: org.slug},
          }),
        ],
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
