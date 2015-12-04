import React from 'react';

import OrganizationIssueList from '../../components/organizationIssueList';

const Bookmarked = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/bookmarked/`;
  },

  getTitle() {
    return 'Bookmarks';
  },

  render() {
    return (
      <OrganizationIssueList
        title={this.getTitle()}
        endpoint={this.getEndpoint()}
        {...this.props} />
    );
  },
});

export default Bookmarked;
