import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export const setupCheckQueryKey = (orgSlug: string) =>
  `/organizations/${orgSlug}/seer/setup-check/`;

export function useSeerAcknowledgeMutation() {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const {mutate, isPending, isError} = useMutation({
    mutationKey: [setupCheckQueryKey(organization.slug)],
    mutationFn: () => {
      return promptsUpdate(api, {
        organization,
        feature: 'seer_autofix_setup_acknowledged',
        status: 'dismissed',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [setupCheckQueryKey(organization.slug)],
      });
    },
  });

  return {mutate, isPending, isError};
}
