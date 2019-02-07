import React from 'react';
import PropTypes from 'prop-types';
import SentryTypes from 'app/sentryTypes';
import {browserHistory} from 'react-router';

import withEnvironment from 'app/utils/withEnvironment';
import {analytics} from 'app/utils/analytics';
import GroupDetails from '../shared/groupDetails';

class ProjectGroupDetails extends React.Component {
  static propTypes = {
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  componentDidMount() {
    // Redirect any Sentry 10 user that has followed an old link and ended up here
    const {location, params: {orgId, groupId, eventId}} = this.props;
    const hasSentry10 = new Set(this.context.organization.features).has('sentry10');

    if (hasSentry10) {
      const redirectPath = eventId
        ? `/organizations/${orgId}/issues/${groupId}/events/${eventId}/${location.search}`
        : `/organizations/${orgId}/issues/${groupId}/${location.search}`;

      browserHistory.replace(redirectPath);
    }

    this.props.setProjectNavSection('stream');
    analytics('issue_page.viewed', {
      group_id: parseInt(this.props.params.groupId, 10),
      org_id: parseInt(this.context.organization.id, 10),
      project_id: parseInt(this.context.project.id, 10),
    });
  }

  render() {
    // eslint-disable-next-line no-unused-vars
    const {setProjectNavSection, environment, ...props} = this.props;

    return (
      <GroupDetails
        project={this.context.project}
        environments={environment ? [environment.name] : []}
        {...props}
      />
    );
  }
}

export default withEnvironment(ProjectGroupDetails);
