import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

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

export function needsGitHubAuth(e: unknown): boolean {
  const error = e as {responseJSON?: {detail?: unknown}} | null | undefined;
  const detail = error?.responseJSON?.detail;
  if (typeof detail !== 'string') {
    return false;
  }
  const lowerDetail = detail.toLowerCase();
  return lowerDetail.includes('github') && lowerDetail.includes('authorization');
}
