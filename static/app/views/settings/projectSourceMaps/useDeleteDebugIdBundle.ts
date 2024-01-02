import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useMutation, UseMutationOptions} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

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
      addLoadingMessage(t('Deleting bundle\u2026'));
      options.onMutate?.(...args);
    },
    onSuccess: (...args) => {
      addSuccessMessage(t('Bundle deleted.'));
      options.onSuccess?.(...args);
    },
    onError: (...args) => {
      addErrorMessage(t('Unable to delete bundle. Please try again.'));
      options.onError?.(...args);
    },
  });
}
