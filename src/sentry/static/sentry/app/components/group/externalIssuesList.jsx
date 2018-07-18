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
    return group.pluginIssues.map(plugin => {
      return <PluginActions group={group} plugin={plugin} />;
    });
  }

  render() {
    const {integrations} = this.state;
    return (
      <React.Fragment>
        {integrations && this.renderIntegrationIssues(integrations)}
        {this.props.group && this.renderPluginIssues()}
      </React.Fragment>
    );
  }
}

export default ExternalIssueList;
