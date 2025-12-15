import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {
  fetchMutation,
  useMutation,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface RepositorySettings {
  codeReviewTriggers: string[];
  enabledCodeReview: boolean;
  repositoryIds: string[];
}

export function useBulkUpdateRepositorySettings(
  options?: Omit<
    UseMutationOptions<RepositoryWithSettings[], Error, RepositorySettings, unknown>,
    'mutationFn'
  >
) {
  const organization = useOrganization();

  return useMutation<RepositoryWithSettings[], Error, RepositorySettings, unknown>({
    mutationFn: (data: RepositorySettings) => {
      return fetchMutation<RepositoryWithSettings[]>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/repos/settings/`,
        data: {
          codeReviewTriggers: data.codeReviewTriggers,
          enabledCodeReview: data.enabledCodeReview,
          repositoryIds: data.repositoryIds,
        },
      });
    },
    ...options,
  });
}
