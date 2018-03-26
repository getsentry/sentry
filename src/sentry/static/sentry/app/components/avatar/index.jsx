import React from 'react';

import SentryTypes from '../../proptypes';
import SlugAvatar from './slugAvatar';
import TeamAvatar from './teamAvatar';
import UserAvatar from './userAvatar';

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
