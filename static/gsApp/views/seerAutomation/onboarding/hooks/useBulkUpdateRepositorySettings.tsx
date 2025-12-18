import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {
  fetchMutation,
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {getRepositoryWithSettingsQueryKey} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

export type RepositorySettings =
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
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<RepositoryWithSettings[], Error, RepositorySettings, unknown>({
    mutationFn: data => {
      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/repos/settings/`,
        data,
      });
    },
    ...options,
    onSettled: (data, error, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: [`/organizations/${organization.slug}/repos/`],
      });
      (data ?? []).forEach(repo => {
        const queryKey = getRepositoryWithSettingsQueryKey(organization, repo.id);
        queryClient.invalidateQueries({queryKey});
        queryClient.setQueryData(queryKey, [repo, undefined, undefined]);
      });
      options?.onSettled?.(data, error, variables, context);
    },
  });
}
