import type {
  DocIntegration,
  IntegrationFeature,
  OrganizationIntegration,
} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function organizationIntegrationApiOptions({
  organizationSlug,
  integrationId,
}: {
  integrationId: string;
  organizationSlug: string;
}) {
  return apiOptions.as<OrganizationIntegration>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
    {
      path: {organizationIdOrSlug: organizationSlug, integrationId},
      staleTime: 0,
    }
  );
}

export function docIntegrationApiOptions(integrationSlug: string) {
  return apiOptions.as<DocIntegration>()('/doc-integrations/$docIntegrationIdOrSlug/', {
    path: {docIntegrationIdOrSlug: integrationSlug},
    staleTime: Infinity,
  });
}

export function sentryAppFeaturesApiOptions(integrationSlug: string) {
  return apiOptions.as<IntegrationFeature[]>()(
    '/sentry-apps/$sentryAppIdOrSlug/features/',
    {
      path: {sentryAppIdOrSlug: integrationSlug},
      staleTime: Infinity,
    }
  );
}
