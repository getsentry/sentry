import React from 'react';

import SentryTypes from 'app/proptypes';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import ProjectAvatar from 'app/components/avatar/projectAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';

class Avatar extends React.Component {
  static propTypes = {
    team: SentryTypes.Team,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    ...UserAvatar.propTypes,
  };

  static defaultProps = {
    hasTooltip: false,
  };

  render() {
    let {user, team, project, organization, ...props} = this.props;

    if (user) {
      return <UserAvatar user={user} {...props} />;
    }

    if (team) {
      return <TeamAvatar team={team} {...props} />;
    }

    if (project) {
      return <ProjectAvatar project={project} {...props} />;
    }

    // Could support project too
    return <OrganizationAvatar organization={organization} {...props} />;
  }
}

export default Avatar;
