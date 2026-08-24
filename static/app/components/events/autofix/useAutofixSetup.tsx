import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface AutofixSetupResponse {
  billing: {
    hasAutofixQuota: boolean;
  } | null;
  integration: {
    ok: boolean;
    reason: string | null;
  };
  seerReposLinked: boolean;
}

export function autofixSetupApiOptions({
  groupId,
  organizationSlug,
}: {
  groupId: string;
  organizationSlug: string;
}) {
  return {
    ...apiOptions.as<AutofixSetupResponse>()(
      '/organizations/$organizationIdOrSlug/issues/$issueId/autofix/setup/',
      {
        path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
        staleTime: 30_000,
      }
    ),
    retry: false,
  };
}

export function useAutofixSetup(
  {groupId}: {groupId: string},
  {enabled = Boolean(groupId)}: {enabled?: boolean} = {}
) {
  const orgSlug = useOrganization().slug;

  const {data, isPending, refetch} = useQuery({
    ...autofixSetupApiOptions({groupId, organizationSlug: orgSlug}),
    enabled,
  });

  return {
    data,
    isPending,
    refetch,
    canStartAutofix: Boolean(data?.integration.ok),
    hasAutofixQuota: Boolean(data?.billing?.hasAutofixQuota),
    seerReposLinked: Boolean(data?.seerReposLinked),
  };
}
