import React from 'react';

import SentryTypes from 'app/sentryTypes';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

import GroupUserFeedback from '../shared/groupUserFeedback';

class ProjectGroupUserFeedback extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    environment: SentryTypes.Environment,
  };

  render() {
    const {group, environment} = this.props;
    const query = {...this.props.params, ...this.props.location.query};

    if (environment) {
      query.environment = environment.name;
    }

    return <GroupUserFeedback group={group} query={query} />;
  }
}

export default withEnvironmentInQueryString(ProjectGroupUserFeedback);
