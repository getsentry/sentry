import React from 'react';

import {explodeSlug} from '../../utils';
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
    let slug = (team && team.slug) || '';
    let title = explodeSlug(slug);
    let tooltip = `#${title}`;

    return (
      <BaseAvatar type="letter_avatar" letterId={slug} tooltip={tooltip} title={title} />
    );
  }
}
export default TeamAvatar;
