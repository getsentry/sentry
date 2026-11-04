import {useMutation, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
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
      return api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/detectors/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        {
          method: 'PUT',
          data: {enabled: params.enabled},
          query: {
            id: params.ids,
            query: params.query,
            project: params.projects,
          },
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
      toast.success(variables.enabled ? t('Monitors enabled') : t('Monitors disabled'));
    },
    onError: (_, variables) => {
      toast.error(
        t('Unable to %s monitors', variables.enabled ? t('enable') : t('disable'))
      );
    },
  });
}
