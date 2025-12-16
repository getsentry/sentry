import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {
  fetchMutation,
  useMutation,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type RepositorySettings =
  | {
      enabledCodeReview: boolean;
      repositoryIds: string[];
      codeReviewTriggers?: never;
    }
  | {
      codeReviewTriggers: string[];
      repositoryIds: string[];
      enabledCodeReview?: never;
    }
  | {
      codeReviewTriggers: string[];
      enabledCodeReview: boolean;
      repositoryIds: string[];
    };

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
        data,
      });
    },
    ...options,
  });
}
