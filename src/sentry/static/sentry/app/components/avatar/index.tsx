import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import OrganizationAvatar from 'app/components/avatar/organizationAvatar';
import ProjectAvatar from 'app/components/avatar/projectAvatar';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';
import {Team, OrganizationSummary, AvatarProject} from 'app/types';

const BasicModelShape = PropTypes.shape({slug: PropTypes.string});

type Props = {
  team?: Team;
  organization?: OrganizationSummary;
  project?: AvatarProject;
} & UserAvatar['props'];

class Avatar extends React.Component<Props> {
  static propTypes = {
    team: PropTypes.oneOfType([BasicModelShape, SentryTypes.Team]),
    organization: PropTypes.oneOfType([BasicModelShape, SentryTypes.Organization]),
    project: PropTypes.oneOfType([BasicModelShape, SentryTypes.Project]),

    ...UserAvatar.propTypes,
  };

  static defaultProps = {
    hasTooltip: false,
  };

  render() {
    const {user, team, project, organization, ...props} = this.props;

    if (user) {
      return <UserAvatar user={user} {...props} />;
    }

    if (team) {
      return <TeamAvatar team={team} {...props} />;
    }

    if (project) {
      return <ProjectAvatar project={project} {...props} />;
    }

    return <OrganizationAvatar organization={organization} {...props} />;
  }
}

export default React.forwardRef<HTMLSpanElement, Props>((props, ref) => (
  <Avatar forwardedRef={ref} {...props} />
));
