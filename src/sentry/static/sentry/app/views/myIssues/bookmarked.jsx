import React from 'react';

import GroupStore from '../../stores/groupStore';
import IssueList from '../../components/issueList';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';

const Bookmarked = React.createClass({
  componentWillUnmount() {
    GroupStore.reset();
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/bookmarked/`;
  },

  render() {
    return (
      <OrganizationHomeContainer>
        <h1>Bookmarks</h1>
        <IssueList endpoint={this.getEndpoint()} {...this.props} />
      </OrganizationHomeContainer>
    );
  }
});

export default Bookmarked;
