import {Component, Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import {disablePlugin, enablePlugin, fetchPlugins} from 'sentry/actionCreators/plugins';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, Plugin, Project} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withPlugins from 'sentry/utils/withPlugins';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

import ProjectPlugins from './projectPlugins';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  plugins: {
    error: React.ComponentProps<typeof ProjectPlugins>['error'];
    loading: boolean;
    plugins: Plugin[];
  };
  project: Project;
};

class ProjectPluginsContainer extends Component<Props> {
  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const plugins = await fetchPlugins(this.props.params);
    const installCount = plugins.filter(
      plugin => plugin.hasConfiguration && plugin.enabled
    ).length;
    trackIntegrationAnalytics(
      'integrations.index_viewed',
      {
        integrations_installed: installCount,
        view: 'legacy_integrations',
        organization: this.props.organization,
      },
      {startSession: true}
    );
  };

  handleChange = (pluginId: string, shouldEnable: boolean) => {
    const {projectId, orgId} = this.props.params;
    const actionCreator = shouldEnable ? enablePlugin : disablePlugin;
    actionCreator({projectId, orgId, pluginId});
  };

  render() {
    const {loading, error, plugins} = this.props.plugins || {};
    const {orgId} = this.props.params;

    const title = t('Legacy Integrations');

    return (
      <Fragment>
        <SentryDocumentTitle title={title} orgSlug={orgId} />
        <SettingsPageHeader title={title} />
        <PermissionAlert />

        <ProjectPlugins
          {...this.props}
          onChange={this.handleChange}
          loading={loading}
          error={error}
          plugins={plugins}
        />
      </Fragment>
    );
  }
}

export {ProjectPluginsContainer};

export default withPlugins(ProjectPluginsContainer);
