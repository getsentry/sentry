import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {defined} from 'app/utils';
import {Organization, Project, Plugin} from 'app/types';
import {fetchPlugins} from 'app/actionCreators/plugins';
import getDisplayName from 'app/utils/getDisplayName';
import PluginsStore from 'app/stores/pluginsStore';
import SentryTypes from 'app/sentryTypes';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';

type WithPluginProps = {
  organization: Organization;
  project: Project;
};

type InjectedPluginProps = {
  plugins: {plugins: Plugin[]; loading: boolean};
};

/**
 * Higher order component that fetches list of plugins and
 * passes PluginsStore to component as `plugins`
 */
const withPlugins = <P extends WithPluginProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  withOrganization(
    withProject(
      createReactClass<Omit<P, keyof InjectedPluginProps> & WithPluginProps, {}>({
        displayName: `withPlugins(${getDisplayName(WrappedComponent)})`,
        propTypes: {
          organization: SentryTypes.Organization.isRequired,
          project: SentryTypes.Project.isRequired,
        },
        mixins: [Reflux.connect(PluginsStore, 'store') as any],

        componentDidMount() {
          this.fetchPlugins();
        },

        componentDidUpdate(prevProps, _prevState, prevContext) {
          const {organization, project} = this.props;

          // Only fetch plugins when a org slug or project slug has changed
          const prevOrg =
            prevProps.organization || (prevContext && prevContext.organization);
          const prevProject = prevProps.project || (prevContext && prevContext.project);

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
          const isProjectSame = prevProject.slug === project.slug;

          // Don't do anything if org and project are the same
          if (isOrgSame && isProjectSame) {
            return;
          }

          this.fetchPlugins();
        },

        fetchPlugins() {
          const {organization, project} = this.props;

          if (!project || !organization) {
            return;
          }

          fetchPlugins({projectId: project.slug, orgId: organization.slug});
        },

        render() {
          return (
            <WrappedComponent
              {...(this.props as P & WithPluginProps)}
              plugins={this.state.store}
            />
          );
        },
      })
    )
  );

export default withPlugins;
