import React from 'react';
import ActivityFeed from '../components/activity/feed';
import {t} from '../locale';

const UserActivity = React.createClass({

  render() {
    let params = this.props.params;
    return (
      <ActivityFeed ref="activityFeed" endpoint={`/organizations/${params.orgId}/users/${params.userId}/activity/`} query={{
          per_page: 10,
        }} pagination={false}
        renderEmpty={() => <div className="sidebar-panel-empty" key="none">{t('No recent activity')}</div>}
        {...this.props} />
    );
  }
});

export default UserActivity;

