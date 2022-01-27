import Settings from 'sentry/plugins/components/settings';
import {Organization, Plugin, Project} from 'sentry/types';

type Props = {
  organization: Organization;
  project: Project;
};

class BasePlugin {
  plugin: Plugin;
  constructor(data: Plugin) {
    this.plugin = data;
  }

  renderSettings(props: Props) {
    return <Settings plugin={this.plugin} {...props} />;
  }
}

export default BasePlugin;
