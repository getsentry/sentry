import React from 'react';

import OrganizationIssueList from 'app/components/organizationIssueList';
import {t} from 'app/locale';

class Viewed extends React.Component {
  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/members/me/issues/viewed/`;
  };

  getTitle = () => {
    return t('History');
  };

  render() {
    return (
      <OrganizationIssueList
        title={this.getTitle()}
        endpoint={this.getEndpoint()}
        emptyText={t('No recently viewed issues.')}
        {...this.props}
      />
    );
  }
}

export default Viewed;
