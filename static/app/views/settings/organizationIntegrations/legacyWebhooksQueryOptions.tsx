import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export interface WebhookProject {
  enabled: boolean;
  projectId: number;
  projectName: string;
  projectPlatform: PlatformKey;
  projectSlug: string;
}

interface OrgLegacyWebhooksResponse {
  projects: WebhookProject[];
}

export function legacyWebhooksQueryOptions(organization: Organization) {
  return apiOptions.as<OrgLegacyWebhooksResponse>()(
    '/organizations/$organizationIdOrSlug/legacy-webhooks/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 0,
    }
  );
}
