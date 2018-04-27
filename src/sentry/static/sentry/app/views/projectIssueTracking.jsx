import React from 'react';

import {fetchPlugins} from 'app/actionCreators/plugins';
import {t} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import PluginList from 'app/components/pluginList';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import withPlugins from 'app/utils/withPlugins';

class ProjectIssueTracking extends React.Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  static propTypes = {
    plugins: SentryTypes.PluginsStore,
  };

  componentDidMount() {
    let {projectId, orgId} = this.props.params || {};
    fetchPlugins({projectId, orgId});
  }

  render() {
    let {organization, project} = this.context;
    let {loading, plugins} = this.props.plugins || {};

    if (loading || !project || !plugins) {
      return <LoadingIndicator />;
    }

    let issueTrackingPlugins = plugins.filter(function(plugin) {
      return plugin.type === 'issue-tracking' && plugin.hasConfiguration;
    });

    if (issueTrackingPlugins.length) {
      return (
        <div className="ref-issue-tracking-settings">
          <SettingsPageHeader title={t('Issue Tracking')} />
          <TextBlock>
            {t(`Enabling Issue Tracking will let you quickly create tasks within your existing
            tools. You'll find the new action on an issue's details page. Once you create
            an issue, you'll find a helpful annotation and link to the task in your
            project management tool.`)}
          </TextBlock>
          <PluginList
            organization={organization}
            project={project}
            pluginList={issueTrackingPlugins}
          />
        </div>
      );
    } else {
      return (
        <div className="alert alert-info alert-block">
          <p>
            {t(`There are no issue tracker integrations available. Ask your Sentry team about
            integrating with your favorite project management tools.`)}
          </p>
        </div>
      );
    }
  }
}

export default withPlugins(ProjectIssueTracking);
