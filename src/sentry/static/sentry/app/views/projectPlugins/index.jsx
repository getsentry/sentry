import React from 'react';

import {fetchPlugins, enablePlugin, disablePlugin} from '../../actionCreators/plugins';
import withPlugins from '../../utils/withPlugins';
import ProjectPlugins from './projectPlugins';
import SentryTypes from '../../proptypes';

class ProjectPluginsContainer extends React.Component {
  static propTypes = {
    plugins: SentryTypes.PluginsStore,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    fetchPlugins(this.props.params);
  }

  handleChange = (pluginId, shouldEnable) => {
    let {projectId, orgId} = this.props.params;
    let actionCreator = shouldEnable ? enablePlugin : disablePlugin;
    actionCreator({projectId, orgId, pluginId});
  };

  render() {
    let {loading, error, plugins} = this.props.plugins || {};

    return (
      <ProjectPlugins
        {...this.props}
        onError={this.fetchData}
        onChange={this.handleChange}
        loading={loading}
        error={error}
        plugins={plugins}
      />
    );
  }
}

export default withPlugins(ProjectPluginsContainer);
