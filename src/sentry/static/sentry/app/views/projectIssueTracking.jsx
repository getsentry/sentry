import React from 'react';
import PluginList from '../components/pluginList';
import withPlugins from '../utils/withPlugins';

import {t} from '../locale';
import {fetchPlugins} from '../actionCreators/plugins';
import LoadingIndicator from '../components/loadingIndicator';
import SentryTypes from '../proptypes';

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
          <h2>{t('Issue Tracking')}</h2>
          <p>
            Enabling Issue Tracking will let you quickly create tasks within your existing
            tools. You'll find the new action on an issue's details page. Once you create
            an issue, you'll find a helpful annotation and link to the task in your
            project management tool.
          </p>
          <PluginList
            organization={organization}
            project={project}
            pluginList={issueTrackingPlugins}
            onEnablePlugin={this.handleEnablePlugin}
            onDisablePlugin={this.handleDisablePlugin}
          />
        </div>
      );
    } else {
      return (
        <div className="alert alert-info alert-block">
          <p>
            There are no issue tracker integrations available. Ask your Sentry team about
            integrating with your favorite project management tools.
          </p>
        </div>
      );
    }
  }
}

export default withPlugins(ProjectIssueTracking);
