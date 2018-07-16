import React from 'react';
import PropTypes from 'prop-types';

import AsyncComponent from 'app/components/asyncComponent';
import ExternalIssueActions from 'app/components/group/externalIssueActions';

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
        <ExternalIssueActionModal
          key={integration.id}
          integration={integration}
          group={group}
        />
      );
    });
    return externalIssues;
  }

  render() {
    const {integrations} = this.state;
    return (
      <React.Fragment>
        {integrations && this.renderIntegrationIssues(integrations)}
      </React.Fragment>
    );
  }
}

export default ExternalIssueList;
