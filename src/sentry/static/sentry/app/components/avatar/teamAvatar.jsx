import React from 'react';

import {explodeSlug} from 'app/utils';
import BaseAvatar from 'app/components/avatar/baseAvatar';
import SentryTypes from 'app/proptypes';

class TeamAvatar extends React.Component {
  static propTypes = {
    team: SentryTypes.Team.isRequired,
    ...BaseAvatar.propTypes,
  };

  render() {
    let {team, ...props} = this.props;
    if (!team) return null;
    let slug = (team && team.slug) || '';
    let title = explodeSlug(slug);
    let tooltip = `#${title}`;

    return (
      <BaseAvatar
        {...props}
        type="letter_avatar"
        letterId={slug}
        tooltip={tooltip}
        title={title}
      />
    );
  }
}
export default TeamAvatar;
