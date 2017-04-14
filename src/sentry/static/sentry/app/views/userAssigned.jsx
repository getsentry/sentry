import React from 'react';
import IssueList from '../components/issueList';
import {t} from '../locale';


const UserAssigned = React.createClass({
  render() {
    let params = this.props.params;
    return (
      <div>
        <IssueList
          title={t('Assigned')}
          endpoint={`/organizations/${params.orgId}/members/${params.userId}/issues/assigned/`}
          params={{orgId: params.orgId}}
          pagination={false}
          renderEmpty={() => <div className="sidebar-panel-empty" key="none">{t('No issues have been assigned to you.')}</div>} />
      </div>
    );
  }
});

export default UserAssigned;