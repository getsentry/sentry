import React from 'react';
import SentryTypes from 'app/sentryTypes';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import GroupTagValues from '../shared/groupTagValues';

class ProjectGroupTagValues extends React.Component {
  static propTypes = {
    environment: SentryTypes.Environment,
  };
  render() {
    const {environment} = this.props;
    const query = environment ? {environment: environment.name} : {};
    return <GroupTagValues {...this.props} query={query} />;
  }
}

export default withEnvironmentInQueryString(ProjectGroupTagValues);
