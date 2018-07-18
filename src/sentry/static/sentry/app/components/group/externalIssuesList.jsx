import React from 'react';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import ExternalIssueActions from 'app/components/group/externalIssueActions';
import PluginActions from 'app/components/group/pluginActions';

class ExternalIssueList extends AsyncComponent {
  static propTypes = {
    group: PropTypes.object.isRequired,
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

    return (
      <div className="m-b-2">
        <h6>
          <span>Linked Issues</span>
        </h6>
        {externalIssues}
      </div>
    );
  }

  renderPluginIssues() {
    const {group} = this.props;

    return group.pluginIssues && group.pluginIssues.length ? (
      <div className="m-b-2">
        <h6>
          <span>Linked Issues (Legacy)</span>
        </h6>
        {group.pluginIssues.map((plugin, i) => {
          return <PluginActions group={group} plugin={plugin} key={i} />;
        })}
      </div>
    ) : null;
  }

  render() {
    const {integrations} = this.state;

    return (
      <React.Fragment>
        {this.renderIntegrationIssues(integrations)}
        {this.renderPluginIssues()}
      </React.Fragment>
    );
  }
}

export default ExternalIssueList;
