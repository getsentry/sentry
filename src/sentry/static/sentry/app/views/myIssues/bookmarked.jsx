import React from 'react';

import OrganizationIssueList from '../../components/organizationIssueList';
import {t} from '../../locale';

const Bookmarked = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/bookmarked/`;
  },

  getTitle() {
    return t('Bookmarks');
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
