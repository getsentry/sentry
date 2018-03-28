import React from 'react';

import {t} from '../../locale';
import {fetchPlugins, enablePlugin, disablePlugin} from '../../actionCreators/plugins';
import withPlugins from '../../utils/withPlugins';
import ProjectPlugins from './projectPlugins';
import OrganizationIntegrations from './organizationIntegrations';
import SentryTypes from '../../proptypes';
import SettingsPageHeader from '../settings/components/settingsPageHeader';

class ProjectPluginsContainer extends React.Component {
  static propTypes = {
    plugins: SentryTypes.PluginsStore,
  };

  componentDidMount() {
    this.fetchData();
  }

  fetchData() {
    fetchPlugins(this.props.params);
  }

  handleChange = (pluginId, shouldEnable) => {
    let {projectId, orgId} = this.props.params;
    let actionCreator = shouldEnable ? enablePlugin : disablePlugin;
    actionCreator({projectId, orgId, pluginId});
  };

  render() {
    let {loading, error, plugins} = this.props.plugins || {};

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Integrations')} />

        <OrganizationIntegrations
          orgId={this.props.params.orgId}
          projectId={this.props.params.projectId}
        />

        <ProjectPlugins
          {...this.props}
          onError={this.fetchData}
          onChange={this.handleChange}
          loading={loading}
          error={error}
          plugins={plugins}
        />
      </React.Fragment>
    );
  }
}

export default withPlugins(ProjectPluginsContainer);
