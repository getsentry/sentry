import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openPluginActionModal} from 'sentry/components/group/pluginActions';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {GroupIntegrationIssueResult} from './types';

export function usePluginExternalIssues({
  group,
  project,
}: {
  group: Group;
  project: Project;
}): GroupIntegrationIssueResult {
  const api = useApi();
  const organization = useOrganization();

  const result: GroupIntegrationIssueResult = {integrations: [], linkedIssues: []};

  const combinedPlugins = [...group.pluginIssues, ...group.pluginActions];
  for (const plugin of combinedPlugins) {
    const displayIcon = getIntegrationIcon(plugin.id, 'sm');
    const displayName = plugin.name || plugin.title;
    if (plugin.issue) {
      result.linkedIssues.push({
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
      result.integrations.push({
        key: plugin.id,
        displayName,
        displayIcon,
        actions: [
          {
            name: plugin.shortName,
            onClick: () => {
              plugins.load(plugin, () => {
                openPluginActionModal({
                  plugin,
                  group,
                  project,
                  organization,
                  // Is passed to both modal onClose and onSuccess which is a bit goofy
                  onModalClose: (data?: any | string) => {
                    // String could be one of 'close-button', 'backdrop-click', 'escape-key'
                    if (!data || typeof data === 'string') {
                      return;
                    }

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
              });
            },
          },
        ],
      });
    }
  }

  return result;
}
