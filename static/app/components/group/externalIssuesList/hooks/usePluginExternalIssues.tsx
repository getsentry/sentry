import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openPluginActionModal} from 'sentry/components/group/pluginActions';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {IntegrationResult} from './types';

export function usePluginExternalIssues({
  group,
  project,
}: {
  group: Group;
  project: Project;
}): IntegrationResult {
  const api = useApi();
  const organization = useOrganization();

  const linkedIssues: IntegrationResult['linkedIssues'] = [];
  const integrations: IntegrationResult['integrations'] = [];

  const combinedPlugins = [...group.pluginIssues, ...group.pluginActions];
  for (const plugin of combinedPlugins) {
    const displayIcon = getIntegrationIcon(plugin.id, 'sm');
    const displayName = plugin.name || plugin.title;
    if (plugin.issue) {
      linkedIssues.push({
        key: plugin.id,
        displayName: `${displayName} Issue`,
        displayIcon,
        title: plugin.issue.issue_id,
        url: plugin.issue.url,
        onUnlink: () => {
          const newPlugin: any = {
            ...plugin,
            // Remove issue from plugin
            issue: null,
          };

          const endpoint = `/issues/${group.id}/plugins/${plugin.slug}/unlink/`;
          api.request(endpoint, {
            success: () => {
              plugins.load(newPlugin, () => {
                addSuccessMessage(t('Successfully unlinked issue.'));
              });
            },
            error: () => {
              addErrorMessage(t('Unable to unlink issue'));
            },
          });
        },
      });
    } else {
      integrations.push({
        key: plugin.id,
        displayName,
        displayIcon,
        actions: [
          {
            name: plugin.shortName,
            onClick: () => {
              openPluginActionModal({
                plugin,
                group,
                project,
                organization,
                onModalClose: (data?: any) => {
                  const updatedPlugin: any = {
                    ...plugin,
                    // Remove issue from plugin
                    issue:
                      data?.id && data?.link
                        ? {issue_id: data.id, url: data.link, label: data.label}
                        : null,
                  };
                  plugins.load(updatedPlugin, () => {
                    addSuccessMessage(t('Successfully linked issue.'));
                  });
                },
              });
            },
          },
        ],
      });
    }
  }

  return {integrations, linkedIssues};
}
