import {t} from 'sentry/locale';
import {
  fetchMutation,
  useIsMutating,
  useMutation,
  useMutationState,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

const MUTATION_KEY = 'channel-validation';

type Response = {
  valid: boolean;
  detail?: string;
};

type Variables = {
  channel: string;
  integrationId: string;
};

/**
 * Checks whether a manually entered integration channel (e.g., Slack channel, Discord server) is valid.
 */
export function useValidateChannel() {
  const organization = useOrganization();

  return useMutation<Response, RequestError, Variables>({
    mutationKey: [MUTATION_KEY],
    mutationFn: async ({channel, integrationId}) => {
      return fetchMutation({
        url: `/organizations/${organization.slug}/integrations/${integrationId}/channel-validate/`,
        method: 'POST',
        data: {
          channel,
        },
      });
    },
  });
}

export function useChannelValidationError(): string | undefined {
  const mutations = useMutationState({
    filters: {mutationKey: [MUTATION_KEY]},
    select: mutation => {
      const data = mutation.state.data as {detail?: string; valid?: boolean} | undefined;
      const error = mutation.state.error as RequestError | undefined;
      if (data?.valid === false) {
        return data.detail ?? t('Invalid integration channel');
      }
      if (error) {
        return t('Unexpected integration channel validation error');
      }
      return undefined;
    },
  });
  return mutations?.[mutations.length - 1];
}

export function useIsValidatingChannel() {
  return Boolean(useIsMutating({mutationKey: [MUTATION_KEY]}));
}

export function useResetChannelValidation() {
  const queryClient = useQueryClient();
  return () => {
    const mutationCache = queryClient.getMutationCache();
    const mutations = mutationCache.findAll({mutationKey: [MUTATION_KEY]});
    mutations.forEach(mutation => {
      mutationCache.remove(mutation);
    });
  };
}
