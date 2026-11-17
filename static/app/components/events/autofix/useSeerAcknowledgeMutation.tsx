import {useMutation, useQueryClient} from '@tanstack/react-query';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

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
      // Invalidate organization-level setup check
      queryClient.invalidateQueries({
        queryKey: apiOptions.queryKey(
          '/organizations/$organizationIdOrSlug/seer/setup-check/',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
      });
      // Invalidate all group-level autofix setup queries
      queryClient.invalidateQueries({
        queryKey: apiOptions.queryKey(
          '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/*',
          {path: {organizationIdOrSlug: organization.slug}}
        ),
      });
    },
  });

  return {mutate, isPending, isError};
}
