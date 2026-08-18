import {useAutofixRepos} from 'sentry/components/events/autofix/useAutofixRepos';
import type {Group} from 'sentry/types/group';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useIntegrations} from 'sentry/utils/integrations/useIntegrations';
import {getProviderPermissionsUrl} from 'sentry/views/settings/organizationRepositories/getProviderConfigUrl';

interface PermissionsTarget {
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
}): {isPending: boolean; permissionsTarget: PermissionsTarget | null} {
  const repos = useAutofixRepos({group, enabled});
  const integrationIds =
    repos.data?.repos
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

  return {
    permissionsTarget,
    isPending: enabled && (repos.isPending || isIntegrationsPending),
  };
}
