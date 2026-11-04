import {useMutation} from '@tanstack/react-query';
import type {UseMutationOptions} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
interface DeleteDebugIdArtifactsVariables {
  bundleId: string;
  projectSlug: string;
}

export function useDeleteDebugIdBundle(
  options: Omit<
    UseMutationOptions<unknown, RequestError, DeleteDebugIdArtifactsVariables>,
    'mutationFn'
  > = {}
) {
  const api = useApi();
  const organization = useOrganization();

  return useMutation<unknown, RequestError, DeleteDebugIdArtifactsVariables>({
    ...options,
    mutationFn: ({projectSlug, bundleId}: DeleteDebugIdArtifactsVariables) => {
      const debugIdBundlesEndpoint = `/projects/${organization.slug}/${projectSlug}/files/artifact-bundles/`;
      return api.requestPromise(debugIdBundlesEndpoint, {
        method: 'DELETE',
        query: {bundleId},
      });
    },
    onMutate: (...args) => {
      toast.loading(t('Deleting bundle\u2026'));
      options.onMutate?.(...args);
    },
    onSuccess: (...args) => {
      toast.success(t('Bundle deleted.'));
      options.onSuccess?.(...args);
    },
    onError: (...args) => {
      toast.error(t('Unable to delete bundle. Please try again.'));
      options.onError?.(...args);
    },
  });
}
