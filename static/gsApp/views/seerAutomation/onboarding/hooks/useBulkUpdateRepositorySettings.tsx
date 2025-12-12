import type {RepositoryWithSettings} from 'sentry/types/integrations';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface RepositorySettings {
  codeReviewTriggers: string[];
  enabledCodeReview: boolean;
  repositoryIds: string[];
}

export function useBulkUpdateRepositorySettings() {
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
  });
}
