import {Component} from 'react';

import {fetchPlugins} from 'sentry/actionCreators/plugins';
import PluginsStore from 'sentry/stores/pluginsStore';
import type {Plugin} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import getDisplayName from 'sentry/utils/getDisplayName';
import withOrganization from 'sentry/utils/withOrganization';
import withProject from 'sentry/utils/withProject';

type WithPluginProps = {
  organization: Organization;
  project?: Project;
};

type State = {
  loading: boolean;
  plugins: Plugin[];
};

/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
function withPlugins<P extends WithPluginProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithPlugins extends Component<Omit<P, 'plugins'> & WithPluginProps, State> {
    static displayName = `withPlugins(${getDisplayName(WrappedComponent)})`;
    state = {plugins: [], loading: true};

    componentDidMount() {
      this.fetchPlugins();
    }

    componentDidUpdate(prevProps: any, _prevState: any, prevContext: any) {
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
        <WrappedComponent
          // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
          {...(this.props as P & WithPluginProps as any)}
          plugins={this.state}
        />
      );
    }
  }
  return withOrganization(withProject(WithPlugins));
}

export default withPlugins;
