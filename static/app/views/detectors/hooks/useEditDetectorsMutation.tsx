import {useMutation, useQueryClient} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {invalidateDetectorQueries} from 'sentry/views/detectors/hooks';

/** Bulk update detectors. Currently supports enabling/disabling detectors. */
export function useUpdateDetectorsMutation() {
  const org = useOrganization();
  const queryClient = useQueryClient();

  return useMutation<
    void,
    RequestError,
    {enabled: boolean; ids?: string[]; projects?: number[]; query?: string}
  >({
    mutationFn: params => {
      return fetchMutation<void>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/detectors/', {
          path: {organizationIdOrSlug: org.slug},
        }),
        method: 'PUT',
        data: {enabled: params.enabled},
        options: {query: {id: params.ids, query: params.query, project: params.projects}},
      });
    },
    onSuccess: (_, variables) => {
      invalidateDetectorQueries(queryClient, org);
      toast.success(variables.enabled ? t('Monitors enabled') : t('Monitors disabled'));
    },
    onError: (error, variables) => {
      const detail = error.responseJSON?.detail;
      const fallback = variables.enabled
        ? t('Unable to enable monitors')
        : t('Unable to disable monitors');
      toast.error(typeof detail === 'string' ? detail : fallback);
    },
  });
}
