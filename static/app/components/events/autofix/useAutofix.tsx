import {useQuery} from '@tanstack/react-query';

import {type AutofixData} from 'sentry/components/events/autofix/types';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

type AutofixResponse = {
  autofix: AutofixData | null;
};

function autofixApiOptions(orgSlug: string, groupId: string, isUserWatching = false) {
  return apiOptions.as<AutofixResponse>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/',
    {
      path: {organizationIdOrSlug: orgSlug, issueId: groupId},
      query: {isUserWatching, mode: 'legacy'},
      staleTime: Infinity,
    }
  );
}

export const useAutofixData = ({
  groupId,
  isUserWatching = false,
}: {
  groupId: string;
  isUserWatching?: boolean;
}) => {
  const orgSlug = useOrganization().slug;

  const {data, isPending} = useQuery({
    ...autofixApiOptions(orgSlug, groupId, isUserWatching),
    enabled: false,
  });

  return {data: data?.autofix ?? null, isPending};
};

export type CodingAgentIntegration = {
  id: string | null;
  name: string;
  provider: string;
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
