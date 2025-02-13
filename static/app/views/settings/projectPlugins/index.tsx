import {Component, Fragment} from 'react';

import {disablePlugin, enablePlugin, fetchPlugins} from 'sentry/actionCreators/plugins';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Plugin} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withPlugins from 'sentry/utils/withPlugins';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

import ProjectPlugins from './projectPlugins';

type Props = RouteComponentProps<{projectId: string}, {}> & {
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
    const {organization, params} = this.props;

    const plugins = await fetchPlugins({...params, orgId: organization.slug});
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
    const {organization, params} = this.props;

    const actionCreator = shouldEnable ? enablePlugin : disablePlugin;
    actionCreator({projectId: params.projectId, orgId: organization.slug, pluginId});
  };

  render() {
    const {loading, error, plugins} = this.props.plugins || {};
    const {organization, project} = this.props;

    const title = t('Legacy Integrations');

    return (
      <Fragment>
        <SentryDocumentTitle title={title} orgSlug={organization.slug} />
        <SettingsPageHeader title={title} />
        <ProjectPermissionAlert margin={false} project={project} />

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
