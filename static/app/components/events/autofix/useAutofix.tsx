import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {RequestError} from 'sentry/utils/requestError/requestError';

export type CodingAgentIntegration = {
  id: string | null;
  name: string;
  provider: 'claude_code' | 'cursor' | 'github_copilot';
  has_identity?: boolean;
  requires_identity?: boolean;
};

export function organizationIntegrationsCodingAgents(organization: Organization) {
  return apiOptions.as<{
    integrations: CodingAgentIntegration[];
  }>()('/organizations/$organizationIdOrSlug/integrations/coding-agents/', {
    path: {organizationIdOrSlug: organization.slug},
    staleTime: 5 * 60 * 1000,
  });
}

export function needsGitHubAuth(error: RequestError): boolean {
  const detail = error.responseJSON?.detail;
  return (
    typeof detail === 'string' &&
    detail.toLowerCase().includes('github') &&
    detail.toLowerCase().includes('authorization')
  );
}
