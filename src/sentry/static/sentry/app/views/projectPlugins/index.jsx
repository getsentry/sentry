import React from 'react';
import Reflux from 'reflux';

import {fetchPlugins, enablePlugin, disablePlugin} from '../../actionCreators/plugins';
import ApiMixin from '../../mixins/apiMixin';
import PluginsStore from '../../stores/pluginsStore';
import ProjectPlugins from './projectPlugins';

const ProjectPluginsContainer = React.createClass({
  mixins: [ApiMixin, Reflux.connect(PluginsStore, 'store')],
  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    fetchPlugins(this.api, this.props.params, {noReset: true});
  },

  handleChange(pluginId, shouldEnable) {
    let {projectId, orgId} = this.props.params;
    let actionCreator = shouldEnable ? enablePlugin : disablePlugin;
    actionCreator(this.api, {projectId, orgId, pluginId});
  },

  render() {
    let {store} = this.state;

    return (
      <ProjectPlugins
        {...this.props}
        onError={this.fetchData}
        onChange={this.handleChange}
        error={store.error}
        plugins={store.plugins}
      />
    );
  },
});

export default ProjectPluginsContainer;
