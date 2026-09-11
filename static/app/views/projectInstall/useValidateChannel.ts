import {skipToken} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {IntegrationChannel} from 'sentry/views/projectInstall/issueAlertNotificationOptions';

type Response = {
  valid: boolean;
  detail?: string;
};

/**
 * Returns the query options for checking whether a manually entered integration
 * channel (e.g., Slack channel, Discord server) is valid.
 */
export function validateChannelQueryOptions({
  organizationSlug,
  channel,
  integrationId,
}: {
  organizationSlug: string;
  channel?: IntegrationChannel;
  integrationId?: string;
}) {
  return apiOptions.as<Response>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/channel-validate/',
    {
      path: integrationId
        ? {organizationIdOrSlug: organizationSlug, integrationId}
        : skipToken,
      query: {channel: channel?.label},
      staleTime: 0,
    }
  );
}
