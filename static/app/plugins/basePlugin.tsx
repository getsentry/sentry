import {PluginSettings} from 'sentry/plugins/components/settings';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

type Props = {
  organization: Organization;
  project: Project;
};

export class BasePlugin {
  plugin: Plugin;
  constructor(data: Plugin) {
    this.plugin = data;
  }

  renderSettings(props: Props) {
    return <PluginSettings plugin={this.plugin} {...props} />;
  }
}
