import React from 'react';

import GroupStore from '../../stores/groupStore';
import IssueList from '../../components/issueList';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';

const AssignedToMe = React.createClass({
  componentWillUnmount() {
    GroupStore.reset();
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/`;
  },

  render() {
    return (
      <OrganizationHomeContainer>
        <h3>Assigned to Me</h3>
        <IssueList endpoint={this.getEndpoint()} {...this.props} />
      </OrganizationHomeContainer>
    );
  }
});

export default AssignedToMe;
