import React from 'react';
import PropTypes from 'prop-types';
import SentryTypes from 'app/sentryTypes';

import GroupTagValues from '../shared/groupTagValues';

class OrganizationGroupTagValues extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    location: PropTypes.object,
  };

  render() {
    // Clone so we don't have props mutate in place.
    const query = {...this.props.location.query};
    return <GroupTagValues {...this.props} query={query} />;
  }
}

export default OrganizationGroupTagValues;
