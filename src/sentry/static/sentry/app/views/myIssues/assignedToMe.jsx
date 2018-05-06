import React from 'react';

import OrganizationIssueList from 'app/components/organizationIssueList';
import {t} from 'app/locale';

class AssignedToMe extends React.Component {
  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/`;
  };

  getTitle = () => {
    return t('Assigned to me');
  };

  render() {
    return (
      <OrganizationIssueList
        title={this.getTitle()}
        endpoint={this.getEndpoint()}
        emptyText={t('No issues currently assigned to you.')}
        {...this.props}
      />
    );
  }
}

export default AssignedToMe;
