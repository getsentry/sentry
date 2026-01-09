import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openPluginActionModal} from 'sentry/components/group/pluginActionsModal';
import {t} from 'sentry/locale';
import plugins from 'sentry/plugins';
import GroupStore from 'sentry/stores/groupStore';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {uniqueId} from 'sentry/utils/guid';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {GroupIntegrationIssueResult} from './types';

type LinkedIssueResponse = {
  id: string;
  issue_url: string;
  label: string;
  link: string;
};

/**
 * Formats plugin issues into external issue actions
 * Example plugin: Trello
 */
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

  for (const plugin of group.pluginIssues) {
    const displayIcon = getIntegrationIcon(plugin.id, 'sm');
    const displayName = plugin.name || plugin.title;
    if (plugin.issue) {
      result.linkedIssues.push({
        key: `plugin-linked-${plugin.id}`,
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
          const newPluginIssues = group.pluginIssues.filter(p => p.id !== plugin.id);
          newPluginIssues.push(newPlugin);

          const endpoint = `/issues/${group.id}/plugins/${plugin.slug}/unlink/`;
          api.request(endpoint, {
            success: () => {
              plugins.load(newPlugin, () => {
                addSuccessMessage(t('Successfully unlinked issue.'));
              });
              GroupStore.onUpdateSuccess(uniqueId(), [group.id], {
                pluginIssues: newPluginIssues,
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
        key: `plugin-${plugin.id}`,
        displayName,
        displayIcon,
        actions: [
          {
            id: plugin.id,
            name: plugin.shortName,
            onClick: () => {
              plugins.load(plugin, () => {
                openPluginActionModal({
                  plugin,
                  group,
                  project,
                  organization,
                  // Is passed to both modal onClose and onSuccess which is a bit goofy
                  onModalClose: (data?: LinkedIssueResponse | string) => {
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
                    // Add linked issue to group
                    GroupStore.onUpdateSuccess(uniqueId(), [group.id], {
                      pluginIssues: [...group.pluginIssues, updatedPlugin],
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

  for (const [title, action] of group.pluginActions) {
    result.integrations.push({
      key: `plugin-action-${title}-${action}`,
      displayName: title,
      displayIcon: getIntegrationIcon(title, 'sm'),
      actions: [
        {
          id: `${title}-${action}`,
          name: action,
          href: action,
          onClick: () => {
            // Do nothing
          },
        },
      ],
    });
  }

  return result;
}
