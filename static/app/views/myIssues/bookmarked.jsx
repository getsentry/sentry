import React from 'react';

import OrganizationIssueList from 'app/components/organizationIssueList';
import {t} from 'app/locale';

class Bookmarked extends React.Component {
  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/members/me/issues/bookmarked/`;
  };

  getTitle = () => {
    return t('Bookmarks');
  };

  render() {
    return (
      <OrganizationIssueList
        title={this.getTitle()}
        endpoint={this.getEndpoint()}
        emptyText={t('You have not bookmarked any issues.')}
        {...this.props}
      />
    );
  }
}

export default Bookmarked;
