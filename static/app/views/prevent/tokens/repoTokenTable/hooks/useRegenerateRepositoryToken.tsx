import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openTokenRegenerationConfirmationModal} from 'sentry/actionCreators/modal';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

type RepositoryTokenResponse = {
  token: string;
};

type RegenerateTokenVariables = {
  integratedOrgId: string;
  orgSlug: string;
  repository: string;
};

export function useRegenerateRepositoryToken() {
  const queryClient = useQueryClient();

  return useMutation<RepositoryTokenResponse, RequestError, RegenerateTokenVariables>({
    mutationFn: ({orgSlug, integratedOrgId, repository}) =>
      fetchMutation({
        method: 'POST',
        url: `/organizations/${orgSlug}/prevent/owner/${integratedOrgId}/repository/${repository}/token/regenerate/`,
      }),
    onSuccess: (data, variables) => {
      addSuccessMessage('Token regenerated successfully.');
      openTokenRegenerationConfirmationModal({token: data.token});

      // Invalidate the query responsible for fetching the repository tokens to update the table
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl(
            `/organizations/$organizationIdOrSlug/prevent/owner/$owner/repositories/tokens/`,
            {
              path: {
                organizationIdOrSlug: variables.orgSlug,
                owner: variables.integratedOrgId,
              },
            }
          ),
        ],
      });
      // Invalidate the specific repository query
      queryClient.invalidateQueries({
        queryKey: [
          getApiUrl(
            `/organizations/$organizationIdOrSlug/prevent/owner/$owner/repository/$repository/`,
            {
              path: {
                organizationIdOrSlug: variables.orgSlug,
                owner: variables.integratedOrgId,
                repository: variables.repository,
              },
            }
          ),
        ],
      });
    },
    onError: () => {
      addErrorMessage('Failed to regenerate token.');
    },
  });
}
