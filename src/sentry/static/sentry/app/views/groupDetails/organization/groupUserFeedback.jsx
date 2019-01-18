import React from 'react';

import SentryTypes from 'app/sentryTypes';

import GroupUserFeedback from '../shared/groupUserFeedback';

class OrganizationGroupUserFeedback extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
  };

  render() {
    const {group} = this.props;
    const query = {...this.props.params};

    return <GroupUserFeedback group={group} query={query} />;
  }
}

export default OrganizationGroupUserFeedback;
