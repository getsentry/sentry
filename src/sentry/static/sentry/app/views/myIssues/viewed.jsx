import React from 'react';

import GroupStore from '../../stores/groupStore';
import IssueList from '../../components/issueList';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';

const Viewed = React.createClass({
  componentWillUnmount() {
    GroupStore.reset();
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/viewed/`;
  },

  render() {
    return (
      <OrganizationHomeContainer>
        <h3>History</h3>
        <IssueList endpoint={this.getEndpoint()} {...this.props} />
      </OrganizationHomeContainer>
    );
  }
});

export default Viewed;
