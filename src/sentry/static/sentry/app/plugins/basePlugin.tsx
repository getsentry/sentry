import Settings from 'app/plugins/components/settings';
import {Plugin, Project, Organization} from 'app/types';

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
