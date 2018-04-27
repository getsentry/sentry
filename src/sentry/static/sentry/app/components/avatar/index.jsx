import React from 'react';

import SentryTypes from 'app/proptypes';
import SlugAvatar from 'app/components/avatar/slugAvatar';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';

class Avatar extends React.Component {
  static propTypes = {
    team: SentryTypes.Team,
    organization: SentryTypes.Organization,
    ...UserAvatar.propTypes,
    ...SlugAvatar.propTypes,
  };

  static defaultProps = {
    hasTooltip: false,
  };

  render() {
    let {user, team, organization, ...props} = this.props;

    if (user) {
      return <UserAvatar user={user} {...props} />;
    }

    if (team) {
      return <TeamAvatar team={team} {...props} />;
    }

    // Could support project too
    return <SlugAvatar model={organization} {...props} />;
  }
}

export default Avatar;
