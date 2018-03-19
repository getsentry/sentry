import React from 'react';

import BaseAvatar from './baseAvatar';
import SentryTypes from '../../proptypes';

class TeamAvatar extends React.Component {
  static propTypes = {
    team: SentryTypes.Team.isRequired,
    ...BaseAvatar.propTypes,
  };

  render() {
    let {team} = this.props;
    if (!team) return null;
    let title = (team && team.slug) || '';

    return (
      <BaseAvatar type="letter_avatar" letterId={title} tooltip={title} title={title} />
    );
  }
}
export default TeamAvatar;
