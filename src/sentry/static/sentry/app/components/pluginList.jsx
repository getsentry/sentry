import PropTypes from 'prop-types';
import React from 'react';

import {enablePlugin, disablePlugin} from '../actionCreators/plugins';
import ApiMixin from '../mixins/apiMixin';
import InactivePlugins from './inactivePlugins';
import PluginConfig from './pluginConfig';
import {t} from '../locale';

const PluginList = React.createClass({
  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    pluginList: PropTypes.array.isRequired,
    onDisablePlugin: PropTypes.func.isRequired,
    onEnablePlugin: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      onDisablePlugin: () => {},
      onEnablePlugin: () => {},
    };
  },

  handleEnablePlugin(plugin) {
    let {organization, project} = this.props;
    enablePlugin({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug,
    });

    this.props.onEnablePlugin(plugin);
  },

  handleDisablePlugin(plugin) {
    let {organization, project} = this.props;
    disablePlugin({
      projectId: project.slug,
      orgId: organization.slug,
      pluginId: plugin.slug,
    });

    this.props.onDisablePlugin(plugin);
  },

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
  },
});

export default PluginList;
