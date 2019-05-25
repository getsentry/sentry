import React from 'react';
import SentryTypes from 'app/sentryTypes';
import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import GroupTags from '../shared/groupTags';

class ProjectGroupTags extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    environment: SentryTypes.Environment,
  };

  constructor(props) {
    super(props);
    this.state = {
      query: this.getQueryFromEnvironment(props.environment),
    };
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.environment !== this.props.environment) {
      this.setState({query: this.getQueryFromEnvironment(nextProps.environment)});
    }
  }

  getQueryFromEnvironment(environment) {
    return environment ? {environment: environment.name} : {};
  }

  render() {
    return (
      <GroupTags
        group={this.props.group}
        params={this.props.params}
        query={this.state.query}
      />
    );
  }
}

export default withEnvironmentInQueryString(ProjectGroupTags);
