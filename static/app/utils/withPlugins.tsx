import * as React from 'react';

import {fetchPlugins} from 'app/actionCreators/plugins';
import PluginsStore from 'app/stores/pluginsStore';
import {Organization, Plugin, Project} from 'app/types';
import {defined} from 'app/utils';
import getDisplayName from 'app/utils/getDisplayName';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

type WithPluginProps = {
  organization: Organization;
  project?: Project;
};

type State = {
  plugins: Plugin[];
  loading: boolean;
};

/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
function withPlugins<P extends WithPluginProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithPlugins extends React.Component<
    Omit<P, keyof 'plugins'> & WithPluginProps,
    State
  > {
    static displayName = `withPlugins(${getDisplayName(WrappedComponent)})`;
    state = {plugins: [], loading: true};

    componentDidMount() {
      this.fetchPlugins();
    }

    componentDidUpdate(prevProps, _prevState, prevContext) {
      const {organization, project} = this.props;

      // Only fetch plugins when a org slug or project slug has changed
      const prevOrg = prevProps.organization || prevContext?.organization;
      const prevProject = prevProps.project || prevContext?.project;

      // If previous org/project is undefined then it means:
      // the HoC has mounted, `fetchPlugins` has been called (via cDM), and
      // store was updated. We don't need to fetchPlugins again (or it will cause an infinite loop)
      //
      // This is for the unusual case where component is mounted and receives a new org/project prop
      // e.g. when switching projects via breadcrumbs in settings.
      if (!defined(prevProject) || !defined(prevOrg)) {
        return;
      }

      const isOrgSame = prevOrg.slug === organization.slug;
      const isProjectSame = prevProject.slug === project?.slug;

      // Don't do anything if org and project are the same
      if (isOrgSame && isProjectSame) {
        return;
      }

      this.fetchPlugins();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = PluginsStore.listen(({plugins, loading}: State) => {
      // State is destructured as store updates contain additional keys
      // that are not exposed by this HoC
      this.setState({plugins, loading});
    }, undefined);

    fetchPlugins() {
      const {organization, project} = this.props;

      if (!project || !organization) {
        return;
      }

      fetchPlugins({projectId: project.slug, orgId: organization.slug});
    }

    render() {
      return (
        <WrappedComponent {...(this.props as P & WithPluginProps)} plugins={this.state} />
      );
    }
  }
  return withOrganization(withProject(WithPlugins));
}

export default withPlugins;
