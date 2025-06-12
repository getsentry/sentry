import {disablePlugin} from 'sentry/actionCreators/plugins';
import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import PluginConfig from 'sentry/components/pluginConfig';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  organization: Organization;
  pluginList: Plugin[];
  project: Project;
  onDisablePlugin?: (plugin: Plugin) => void;
  onEnablePlugin?: (plugin: Plugin) => void;
};

function PluginList({
  organization,
  project,
  pluginList,
  onDisablePlugin = () => {},
}: Props) {
  const handleDisablePlugin = (plugin: Plugin) => {
    disablePlugin({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug,
    });

    onDisablePlugin(plugin);
  };

  if (!pluginList.length) {
    return (
      <Panel>
        <PanelItem>
          {t("Oops! Looks like there aren't any available integrations installed.")}
        </PanelItem>
      </Panel>
    );
  }

  return (
    <div>
      {pluginList
        .filter(p => p.enabled)
        .map(plugin => (
          <PluginConfig
            plugin={plugin}
            project={project}
            key={plugin.id}
            onDisablePlugin={handleDisablePlugin}
          />
        ))}
    </div>
  );
}

export default PluginList;
