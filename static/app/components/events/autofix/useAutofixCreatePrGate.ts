import {useCallback} from 'react';

import {useAutofixRepos} from 'sentry/components/events/autofix/useAutofixRepos';
import type {Group} from 'sentry/types/group';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useIntegrations} from 'sentry/utils/integrations/useIntegrations';
import {getProviderPermissionsUrl} from 'sentry/views/settings/organizationRepositories/getProviderConfigUrl';

export interface PermissionsTarget {
  integration: OrganizationIntegration;
  url: string;
}

/**
 * Gate for creating a PR from Autofix changes: resolves whether a connected repo
 * lacks write access and where to grant it. Shared by the drawer and overview.
 */
export function useAutofixCreatePrGate({
  group,
  enabled = true,
}: {
  group: Pick<Group, 'id'>;
  enabled?: boolean;
}): {
  checkTargetWriteAccess: () => Promise<boolean>;
  isPending: boolean;
  permissionsTarget: PermissionsTarget | null;
} {
  const {
    data: reposData,
    isPending: isReposPending,
    refetch: refetchRepos,
  } = useAutofixRepos({group, enabled});
  const integrationIds =
    reposData?.repos
      ?.filter(repo => !repo.has_write_access)
      .map(repo => repo.integration_id) ?? [];
  const {integrations, isPending: isIntegrationsPending} = useIntegrations({
    integrationIds,
  });

  const permissionsTarget =
    integrations
      .map(integration => {
        const url = getProviderPermissionsUrl(integration);
        return url ? {integration, url} : null;
      })
      .find(Boolean) ?? null;

  const targetIntegrationId = permissionsTarget?.integration.id;
  const checkTargetWriteAccess = useCallback(async () => {
    if (targetIntegrationId === undefined) {
      return true;
    }

    const result = await refetchRepos();
    if (result.isError) {
      return false;
    }

    const matchingRepos =
      result.data?.repos.filter(
        repo => repo.integration_id === Number(targetIntegrationId)
      ) ?? [];

    return matchingRepos.length > 0 && matchingRepos.every(repo => repo.has_write_access);
  }, [targetIntegrationId, refetchRepos]);

  return {
    checkTargetWriteAccess,
    isPending: enabled && (isReposPending || isIntegrationsPending),
    permissionsTarget,
  };
}
