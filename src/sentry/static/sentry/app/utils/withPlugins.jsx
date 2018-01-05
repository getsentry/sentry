import React from 'react';
import Reflux from 'reflux';

import {fetchPlugins} from '../actionCreators/plugins';
import PluginsStore from '../stores/pluginsStore';
import ProjectState from '../mixins/projectState';

/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
const withPlugins = WrappedComponent =>
  React.createClass({
    displayName: 'withPlugins',
    mixins: [ProjectState, Reflux.connect(PluginsStore, 'store')],
    componentDidMount() {
      let organization = this.props.organization || this.getOrganization();
      let project = this.props.project || this.getProject();

      if (!project || !organization) return;

      fetchPlugins({projectId: project.slug, orgId: organization.slug});
    },
    render() {
      return <WrappedComponent {...this.props} plugins={this.state.store} />;
    },
  });

export default withPlugins;
