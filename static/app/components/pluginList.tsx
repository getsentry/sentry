import Panel from 'sentry/components/panels/panel';
import PanelItem from 'sentry/components/panels/panelItem';
import PluginConfig from 'sentry/components/pluginConfig';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useTogglePluginMutation} from 'sentry/views/settings/projectPlugins/useTogglePluginMutation';

type Props = {
  pluginList: Plugin[];
  project: Project;
};

export default function PluginList({project, pluginList}: Props) {
  const togglePluginMutation = useTogglePluginMutation({
    projectSlug: project.slug,
  });
  const handleDisablePlugin = (plugin: Plugin) => {
    togglePluginMutation.mutate({
      pluginId: plugin.slug,
      shouldEnable: false,
    });
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
