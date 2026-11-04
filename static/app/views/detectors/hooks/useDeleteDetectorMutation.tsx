import {useMutation, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
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
      api.requestPromise(
        getApiUrl('/organizations/$organizationIdOrSlug/detectors/$detectorId/', {
          path: {organizationIdOrSlug: org.slug, detectorId},
        }),
        {
          method: 'DELETE',
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
      toast.success(t('Monitor deleted.'));
    },
    onError: error => {
      toast.error(t('Unable to delete monitor: %s', error.message));
    },
  });
}
