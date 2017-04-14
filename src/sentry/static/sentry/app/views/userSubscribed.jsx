import React from 'react';
import IssueList from '../components/issueList';
import {t} from '../locale';


const UserSubscribed = React.createClass({
  render() {
    let params = this.props.params;
    return (
      <div>
        <IssueList
          title={t('Assigned')}
          endpoint={`/organizations/${params.orgId}/users/${params.userId}/subscribed/`}
          params={{orgId: params.orgId}} />
      </div>
    );
  }
});

export default UserSubscribed;