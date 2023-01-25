import {disablePlugin, enablePlugin} from 'sentry/actionCreators/plugins';
import InactivePlugins from 'sentry/components/inactivePlugins';
import {Panel, PanelItem} from 'sentry/components/panels';
import PluginConfig from 'sentry/components/pluginConfig';
import {t} from 'sentry/locale';
import {Organization, Plugin, Project} from 'sentry/types';

type Props = {
  organization: Organization;
  pluginList: Plugin[];
  project: Project;
  onDisablePlugin?: (plugin: Plugin) => void;
  onEnablePlugin?: (plugin: Plugin) => void;
};

const PluginList = ({
  organization,
  project,
  pluginList,
  onDisablePlugin = () => {},
  onEnablePlugin = () => {},
}: Props) => {
  const handleEnablePlugin = (plugin: Plugin) => {
    enablePlugin({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug,
    });

    onEnablePlugin(plugin);
  };

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
        .map(data => (
          <PluginConfig
            data={data}
            organization={organization}
            project={project}
            key={data.id}
            onDisablePlugin={handleDisablePlugin}
          />
        ))}

      <InactivePlugins
        plugins={pluginList.filter(p => !p.enabled && !p.isHidden)}
        onEnablePlugin={handleEnablePlugin}
      />
    </div>
  );
};

export default PluginList;
