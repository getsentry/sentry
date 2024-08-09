import {openPluginActionModal} from 'sentry/components/group/pluginActions';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import useOrganization from 'sentry/utils/useOrganization';

import type {IntegrationResult} from './types';

export function usePluginExternalIssues({
  group,
  project,
}: {
  group: Group;
  project: Project;
}): IntegrationResult {
  const organization = useOrganization();
  const linkedIssues: IntegrationResult['linkedIssues'] = [];
  const integrations: IntegrationResult['integrations'] = [];

  const plugins = [...group.pluginIssues, ...group.pluginActions];
  for (const plugin of plugins) {
    const displayIcon = getIntegrationIcon(plugin.id, 'sm');
    const displayName = plugin.name || plugin.title;
    if (plugin.issue) {
      linkedIssues.push({
        key: plugin.id,
        displayName: `${displayName} Issue`,
        displayIcon,
        title: plugin.issue.issue_id,
        url: plugin.issue.url,
        onUnlink: () => {},
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
                onModalClose: () => {},
              });
            },
          },
        ],
      });
    }
  }

  return {integrations, linkedIssues};
}
