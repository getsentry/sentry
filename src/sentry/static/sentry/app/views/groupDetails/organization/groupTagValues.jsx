import React from 'react';
import GroupTagValues from '../shared/groupTagValues';

export default class OrganizationGroupTagValues extends React.Component {
  render() {
    const query = {};
    return <GroupTagValues {...this.props} query={query} />;
  }
}
