import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {fetchPlugins} from 'app/actionCreators/plugins';
import PluginsStore from 'app/stores/pluginsStore';
import ProjectState from 'app/mixins/projectState';
import SentryTypes from 'app/proptypes';

/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
const withPlugins = WrappedComponent =>
  createReactClass({
    displayName: 'withPlugins',
    propTypes: {
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
    },
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
