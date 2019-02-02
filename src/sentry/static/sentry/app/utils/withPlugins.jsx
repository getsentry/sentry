import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {defined} from 'app/utils';
import {fetchPlugins} from 'app/actionCreators/plugins';
import getDisplayName from 'app/utils/getDisplayName';
import PluginsStore from 'app/stores/pluginsStore';
import ProjectState from 'app/mixins/projectState';
import SentryTypes from 'app/sentryTypes';

/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
const withPlugins = WrappedComponent =>
  createReactClass({
    displayName: `withPlugins(${getDisplayName(WrappedComponent)})`,
    propTypes: {
      organization: SentryTypes.Organization,
      project: SentryTypes.Project,
    },
    mixins: [ProjectState, Reflux.connect(PluginsStore, 'store')],

    componentDidMount() {
      this.fetchPlugins();
    },

    componentDidUpdate(prevProps, prevState, prevContext) {
      const organization = this.props.organization || this.getOrganization();
      const project = this.props.project || this.getProject();

      // Only fetch plugins when a org slug or project slug has changed
      const prevOrg = prevProps.organization || (prevContext && prevContext.organization);
      const prevProject = prevProps.project || (prevContext && prevContext.project);

      // If previous org/project is undefined then it means:
      // the HoC has mounted, `fetchPlugins` has been called (via cDM), and
      // store was updated. We don't need to fetchPlugins again (or it will cause an infinite loop)
      //
      // This is for the unusual case where component is mounted and receives a new org/project prop
      // e.g. when switching projects via breadcrumbs in settings.
      if (!defined(prevProject) || !defined(prevOrg)) return;

      const isOrgSame = prevOrg.slug === organization.slug;
      const isProjectSame = prevProject.slug === project.slug;

      // Don't do anything if org and project are the same
      if (isOrgSame && isProjectSame) return;

      this.fetchPlugins();
    },

    fetchPlugins() {
      const organization = this.props.organization || this.getOrganization();
      const project = this.props.project || this.getProject();

      if (!project || !organization) return;

      fetchPlugins({projectId: project.slug, orgId: organization.slug});
    },

    render() {
      return <WrappedComponent {...this.props} plugins={this.state.store} />;
    },
  });

export default withPlugins;
