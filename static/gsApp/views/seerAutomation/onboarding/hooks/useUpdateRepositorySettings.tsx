import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface RepositorySettings {
  codeReviewTriggers: string[];
  enabledCodeReview: boolean;
  repositoryIds: string[];
}

export function useUpdateRepositorySettings() {
  const organization = useOrganization();

  return useMutation({
    mutationFn: (data: RepositorySettings) => {
      return fetchMutation<RepositorySettings>({
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
