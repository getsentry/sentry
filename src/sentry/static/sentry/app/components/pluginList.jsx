import PropTypes from 'prop-types';
import React from 'react';

import {enablePlugin, disablePlugin} from 'app/actionCreators/plugins';
import InactivePlugins from 'app/components/inactivePlugins';
import PluginConfig from 'app/components/pluginConfig';
import {t} from 'app/locale';

export default class PluginList extends React.Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    pluginList: PropTypes.array.isRequired,
    onDisablePlugin: PropTypes.func.isRequired,
    onEnablePlugin: PropTypes.func.isRequired,
  };

  static defaultProps = {
    onDisablePlugin: () => {},
    onEnablePlugin: () => {},
  };

  handleEnablePlugin = plugin => {
    let {organization, project} = this.props;
    enablePlugin({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug,
    });

    this.props.onEnablePlugin(plugin);
  };

  handleDisablePlugin = plugin => {
    let {organization, project} = this.props;
    disablePlugin({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug,
    });

    this.props.onDisablePlugin(plugin);
  };

  render() {
    let {organization, pluginList, project} = this.props;

    if (!pluginList.length) {
      return (
        <div className="panel panel-default">
          <div className="panel-body p-b-0">
            <p>
              {t("Oops! Looks like there aren't any available integrations installed.")}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div>
        {pluginList.filter(p => p.enabled).map(data => {
          return (
            <PluginConfig
              data={data}
              organization={organization}
              project={project}
              key={data.id}
              onDisablePlugin={this.handleDisablePlugin}
            />
          );
        })}

        <InactivePlugins
          plugins={pluginList.filter(p => !p.enabled)}
          onEnablePlugin={this.handleEnablePlugin}
        />
      </div>
    );
  }
}
