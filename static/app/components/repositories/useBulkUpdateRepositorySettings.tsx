import {useMutation, useQueryClient} from '@tanstack/react-query';
import type {UseMutationOptions} from '@tanstack/react-query';

import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import type {Repository, RepositoryWithSettings} from 'sentry/types/integrations';
import type {CodeReviewTrigger} from 'sentry/types/seer';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

type RepositorySettings =
  | {
      enabledCodeReview: boolean;
      repositoryIds: string[];
      codeReviewTriggers?: never;
    }
  | {
      codeReviewTriggers: CodeReviewTrigger[];
      repositoryIds: string[];
      enabledCodeReview?: never;
    }
  | {
      codeReviewTriggers: CodeReviewTrigger[];
      enabledCodeReview: boolean;
      repositoryIds: string[];
    };

export function useBulkUpdateRepositorySettings(
  options?: Omit<
    UseMutationOptions<RepositoryWithSettings[], Error, RepositorySettings>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();
  const organization = useOrganization();

  return useMutation<RepositoryWithSettings[], Error, RepositorySettings>({
    mutationFn: data => {
      return fetchMutation({
        method: 'PUT',
        url: `/organizations/${organization.slug}/repos/settings/`,
        data,
      });
    },
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: apiOptions.as<Repository[]>()(
          '/organizations/$organizationIdOrSlug/repos/',
          {
            path: {organizationIdOrSlug: organization.slug},
            staleTime: 0,
          }
        ).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: apiOptions.asInfinite<Repository[]>()(
          '/organizations/$organizationIdOrSlug/repos/',
          {
            path: {organizationIdOrSlug: organization.slug},
            staleTime: 0,
          }
        ).queryKey,
      });
      (data ?? []).forEach(repo => {
        const queryKey = getRepositoryWithSettingsQueryKey(organization, repo.id);
        queryClient.invalidateQueries({queryKey});
        queryClient.setQueryData(queryKey, [repo, undefined, undefined]);
      });
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}
