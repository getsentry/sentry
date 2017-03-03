import React from 'react';

import OrganizationIssueList from '../../components/organizationIssueList';
import {t} from '../../locale';

const Viewed = React.createClass({
  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/viewed/`;
  },

  getTitle() {
    return t('History');
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

export default Viewed;
