import React from 'react';
import IssueList from '../components/issueList';
import {t} from '../locale';


const UserResolved = React.createClass({
  render() {
    let params = this.props.params;
    return (
      <div>
        <IssueList
          title={t('Assigned')}
          endpoint={`/organizations/${params.orgId}/members/${params.userId}/issues/assigned/`}
          params={{orgId: params.orgId}} />
        {this.state.data}
      </div>
    );
  }
});

export default UserResolved;