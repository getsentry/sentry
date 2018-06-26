import React from 'react';

import {fetchPlugins, enablePlugin, disablePlugin} from 'app/actionCreators/plugins';
import {t} from 'app/locale';
import ProjectIntegrations from 'app/views/settings/project/projectIntegrations';
import ProjectPlugins from 'app/views/projectPlugins/projectPlugins';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import withPlugins from 'app/utils/withPlugins';

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

        <ProjectIntegrations {...this.props} />

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
