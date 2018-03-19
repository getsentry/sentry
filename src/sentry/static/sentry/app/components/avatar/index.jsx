import React from 'react';

import SlugAvatar from './slugAvatar';
import UserAvatar from './userAvatar';
import SentryTypes from '../../proptypes';

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
      return <UserAvatar {...this.props} />;
    }

    return <SlugAvatar model={team || organization} {...props} />;
  }
}

export default Avatar;
