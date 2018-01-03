import React from 'react';
import PropTypes from 'prop-types';
import AsyncView from './asyncView';
import PluginList from '../components/pluginList';

import {t} from '../locale';

export default class ProjectIssueTracking extends AsyncView {
  static propTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
  };

  getEndpoints() {
    let {projectId, orgId} = this.props.params;
    return [['plugins', `/projects/${orgId}/${projectId}/plugins/`]];
  }

  renderBody() {
    let {organization, project} = this.props;

    let issueTrackingPlugins = this.state.plugins.filter(function(plugin) {
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
            onEnablePlugin={this.fetchData}
            onDisablePlugin={this.fetchData}
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
