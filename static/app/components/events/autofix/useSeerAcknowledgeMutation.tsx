import {useMutation, useQueryClient} from '@tanstack/react-query';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isApiQueryKey} from 'sentry/utils/api/apiQueryKey';
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
        queryKey: apiOptions.as<unknown>()(
          '/organizations/$organizationIdOrSlug/seer/setup-check/',
          {path: {organizationIdOrSlug: organization.slug}, staleTime: 0}
        ).queryKey,
      });
      // Invalidate all group-level autofix setup queries
      queryClient.invalidateQueries({
        predicate: query => {
          if (!isApiQueryKey(query.queryKey)) {
            return false;
          }
          const key = query.queryKey[1].fullUrl;
          return (
            key.includes(`/organizations/${organization.slug}/issues/`) &&
            key.includes('/autofix/setup/')
          );
        },
      });
    },
  });

  return {mutate, isPending, isError};
}
