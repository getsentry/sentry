import {useMutation, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {allDetectorListsQueryKey} from 'sentry/views/detectors/hooks';

/** Bulk delete detectors */
export function useDeleteDetectorsMutation() {
  const org = useOrganization();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    RequestError,
    {ids?: string[]; projects?: number[]; query?: string}
  >({
    mutationFn: params => {
      return fetchMutation<void>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/detectors/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        method: 'DELETE',
        options: {
          query: {
            id: params.ids,
            query: params.query,
            project: params.projects,
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: allDetectorListsQueryKey(org),
      });
      toast.success(t('Monitors deleted'));
    },
    onError: () => {
      toast.error(t('Unable to delete monitors'));
    },
  });
}
