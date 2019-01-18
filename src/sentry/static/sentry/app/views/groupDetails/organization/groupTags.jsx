import React from 'react';
import SentryTypes from 'app/sentryTypes';
import GroupTags from '../shared/groupTags';

export default class OrganizationGroupTags extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
  };

  render() {
    return <GroupTags group={this.props.group} params={this.props.params} query={{}} />;
  }
}
