import {Component, Fragment} from 'react';

import {fetchPlugins, enablePlugin, disablePlugin} from 'app/actionCreators/plugins';
import {t} from 'app/locale';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withPlugins from 'app/utils/withPlugins';
import withOrganization from 'app/utils/withOrganization';
import withProject from 'app/utils/withProject';
import {trackIntegrationEvent} from 'app/utils/integrationUtil';

import ProjectPlugins from './projectPlugins';

class ProjectPluginsContainer extends Component {
  static propTypes = {
    plugins: SentryTypes.PluginsStore,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const plugins = await fetchPlugins(this.props.params);
    const installCount = plugins.filter(
      plugin => plugin.hasConfiguration && plugin.enabled
    ).length;
    trackIntegrationEvent(
      {
        eventKey: 'integrations.index_viewed',
        eventName: 'Integrations: Index Page Viewed',
        integrations_installed: installCount,
        view: 'legacy_integrations',
        project_id: this.props.project.id,
      },
      this.props.organization,
      {startSession: true}
    );
  };

  handleChange = (pluginId, shouldEnable) => {
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
        <SentryDocumentTitle title={title} objSlug={orgId} />
        <SettingsPageHeader title={title} />
        <PermissionAlert />

        <ProjectPlugins
          {...this.props}
          onError={this.fetchData}
          onChange={this.handleChange}
          loading={loading}
          error={error}
          plugins={plugins}
        />
      </Fragment>
    );
  }
}

export default withProject(withOrganization(withPlugins(ProjectPluginsContainer)));
