import React from 'react';

import BaseBadge from 'app/components/idBadge/baseBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import TeamBadge from 'app/components/idBadge/teamBadge';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import OrganizationBadge from 'app/components/idBadge/organizationBadge';
import SentryTypes from 'app/proptypes';

/**
 * Public interface for all "id badges":
 * Organization, project, team, user
 */
export default class IdBadge extends React.Component {
  static propTypes = {
    ...BaseBadge.propTypes,
    team: SentryTypes.Team,
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
    user: SentryTypes.User,
  };

  render() {
    let {organization, project, team, user} = this.props;

    if (organization) {
      return <OrganizationBadge {...this.props} />;
    } else if (project) {
      return <ProjectBadge {...this.props} />;
    } else if (team) {
      return <TeamBadge {...this.props} />;
    } else if (user) {
      return <UserBadge {...this.props} />;
    }

    throw new Error(
      'IdBadge: required property missing (organization, project, team, user)'
    );
  }
}
