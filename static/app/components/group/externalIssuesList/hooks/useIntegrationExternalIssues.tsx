import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {doOpenExternalIssueModal} from 'sentry/components/group/externalIssuesList/externalIssueActions';
import useFetchIntegrations from 'sentry/components/group/externalIssuesList/useFetchIntegrations';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import {
  getIntegrationDisplayName,
  getIntegrationIcon,
} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {ExternalIssueAction, GroupIntegrationIssueResult} from './types';

interface IntegrationExternalIssueOptions {
  group: Group;
}

export function useIntegrationExternalIssues({
  group,
}: IntegrationExternalIssueOptions): GroupIntegrationIssueResult {
  const api = useApi();
  const organization = useOrganization();
  const {
    data: integrations = [],
    isPending,
    refetch: refetchIntegrations,
  } = useFetchIntegrations({group, organization});

  const activeIntegrations = integrations.filter(
    integration => integration.status === 'active'
  );

  const activeIntegrationsByProvider = activeIntegrations.reduce((acc, curr) => {
    const items = acc.get(curr.provider.key);

    if (items) {
      acc.set(curr.provider.key, [...items, curr]);
    } else {
      acc.set(curr.provider.key, [curr]);
    }
    return acc;
  }, new Map<string, GroupIntegration[]>());

  const results: GroupIntegrationIssueResult = {
    integrations: [],
    linkedIssues: [],
    isLoading: isPending,
  };

  for (const [providerKey, configurations] of activeIntegrationsByProvider.entries()) {
    const displayIcon = getIntegrationIcon(providerKey, 'sm');
    // Integrations can have multiple configurations, create an action for each configuration
    const actions = configurations
      .filter(config => config.externalIssues.length === 0)
      .map<ExternalIssueAction>(config => ({
        id: config.id,
        name: config.name,
        nameSubText: config.domainName ?? undefined,
        disabled: config.status === 'disabled',
        onClick: () => {
          doOpenExternalIssueModal({
            group,
            integration: config,
            onChange: refetchIntegrations,
            organization,
          });
        },
      }));

    if (actions.length > 0) {
      // Roll up all configurations into a single integration item
      results.integrations.push({
        displayName: getIntegrationDisplayName(providerKey),
        key: providerKey,
        displayIcon,
        actions,
      });
    }

    // If any configuration has an external issue linked, display it
    results.linkedIssues.push(
      ...configurations
        .filter(config => config.externalIssues.length > 0)
        .map<GroupIntegrationIssueResult['linkedIssues'][number]>(config => ({
          key: config.externalIssues[0]!.id,
          displayName: config.externalIssues[0]!.key,
          displayIcon,
          url: config.externalIssues[0]!.url,
          title: config.externalIssues[0]!.title,
          onUnlink: () => {
            // Currently we do not support a case where there is multiple external issues.
            // For example, we shouldn't have more than 1 jira ticket created for an issue for each jira configuration.
            const issue = config.externalIssues[0];

            api.request(
              `/organizations/${organization.slug}/issues/${group.id}/integrations/${config.id}/`,
              {
                method: 'DELETE',
                query: {externalIssue: issue!.id},
                success: () => {
                  addSuccessMessage(t('Successfully unlinked issue.'));
                  refetchIntegrations();
                },
                error: () => {
                  addErrorMessage(t('Unable to unlink issue.'));
                },
              }
            );
          },
        }))
    );
  }

  return results;
}
