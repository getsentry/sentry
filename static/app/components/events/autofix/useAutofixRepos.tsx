import {useQuery} from '@tanstack/react-query';

import type {AutofixReposResponse} from 'sentry/components/events/autofix/types';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

function autofixReposApiOptions(orgSlug: string, group: Group) {
  return apiOptions.as<AutofixReposResponse>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, issueId: group.id},
      staleTime: 60_000,
    }
  );
}

export function useAutofixRepos({
  group,
  enabled = true,
}: {
  group: Group;
  enabled?: boolean;
}) {
  const organization = useOrganization();

  return useQuery({
    ...autofixReposApiOptions(organization.slug, group),
    enabled,
  });
}
