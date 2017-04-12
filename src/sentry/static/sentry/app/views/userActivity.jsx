import React from 'react';
import ActivityFeed from '../components/activity/feed';

const UserActivity = React.createClass({

  render() {
    let params = this.props.params;
    return (
      <ActivityFeed ref="activityFeed" endpoint={`/organizations/${params.orgId}/users/${params.userId}/activity/`} query={{
          per_page: 10,
        }} pagination={false} {...this.props} />
    );
  }
});

export default UserActivity;

