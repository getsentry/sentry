import {skipToken, useQuery} from '@tanstack/react-query';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function useIntegration({
  orgSlug,
  integrationId,
}: {
  integrationId: string | undefined;
  orgSlug: string;
}) {
  return useQuery(
    apiOptions.as<OrganizationIntegration>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
      {
        path: integrationId ? {organizationIdOrSlug: orgSlug, integrationId} : skipToken,
      }
    )
  );
}
