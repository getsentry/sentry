import {useMemo} from 'react';

import {t} from 'sentry/locale';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, useQueryClient, type ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {IntegrationChannel} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

type Response = {
  valid: boolean;
  detail?: string;
};

/**
 * Checks whether a manually entered integration channel (e.g., Slack channel, Discord server) is valid.
 */
export function useValidateChannel({
  channel,
  integrationId,
  enabled,
}: {
  enabled: boolean;
  channel?: IntegrationChannel;
  integrationId?: string;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const queryKey: ApiQueryKey = useMemo(
    () => [
      getApiUrl(
        `/organizations/$organizationIdOrSlug/integrations/$integrationId/channel-validate/`,
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: integrationId!,
          },
        }
      ),
      {
        query: {
          channel: channel?.label,
        },
      },
    ],
    [organization.slug, integrationId, channel?.label]
  );

  const {isFetching, data, error} = useApiQuery<Response>(queryKey, {
    staleTime: 0,
    enabled,
  });

  return {
    isFetching,
    clear: () =>
      queryClient.removeQueries({
        queryKey,
      }),
    error:
      data?.valid === false
        ? (data.detail ?? t('Channel not found or restricted'))
        : error
          ? t('Unexpected integration channel validation error')
          : undefined,
  };
}
