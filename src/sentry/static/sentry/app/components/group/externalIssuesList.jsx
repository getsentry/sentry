import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import ExternalIssueActions from 'app/components/group/externalIssueActions';
import IssueSyncListElement from 'app/components/issueSyncListElement';
import SentryTypes from 'app/sentryTypes';
import PluginActions from 'app/components/group/pluginActions';

class ExternalIssueList extends AsyncComponent {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
  };

  getEndpoints() {
    let {group} = this.props;
    return [['integrations', `/groups/${group.id}/integrations/`]];
  }

  renderIntegrationIssues(integrations) {
    const {group} = this.props;
    const externalIssues = [];

    if (!integrations || !integrations.length) return null;

    integrations.forEach(integration => {
      externalIssues.push(
        <ExternalIssueActions
          key={integration.id}
          integration={integration}
          group={group}
        />
      );
    });

    return externalIssues;
  }

  renderPluginIssues() {
    const {group} = this.props;

    return group.pluginIssues && group.pluginIssues.length
      ? group.pluginIssues.map((plugin, i) => {
          return <PluginActions group={group} plugin={plugin} key={i} />;
        })
      : null;
  }

  renderPluginActions() {
    const {group} = this.props;

    return group.pluginActions && group.pluginActions.length
      ? group.pluginActions.map((plugin, i) => {
          return (
            <IssueSyncListElement externalIssueLink={plugin[1]} key={i}>
              {plugin[0]}
            </IssueSyncListElement>
          );
        })
      : null;
  }

  renderBody() {
    return (
      <React.Fragment>
        <div className="m-b-2">
          <h6>
            <span>Linked Issues</span>
          </h6>
          {this.renderIntegrationIssues(this.state.integrations)}
          {this.renderPluginIssues()}
          {this.renderPluginActions()}
        </div>
      </React.Fragment>
    );
  }
}

export default ExternalIssueList;
