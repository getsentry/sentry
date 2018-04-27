import React from 'react';
import PropTypes from 'prop-types';

import Avatar from 'app/components/avatar';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';
import {Actor} from 'app/proptypes';

class ActorAvatar extends React.Component {
  static propTypes = {
    actor: Actor.isRequired,
    size: PropTypes.number,
    default: PropTypes.string,
    title: PropTypes.string,
    gravatar: PropTypes.bool,
  };

  render() {
    let {actor, ...props} = this.props;
    if (actor.type == 'user') {
      let user = MemberListStore.getById(actor.id);
      return <Avatar user={user} hasTooltip {...props} />;
    }
    if (actor.type == 'team') {
      let team = TeamStore.getById(actor.id);
      return <Avatar team={team} hasTooltip {...props} />;
    }

    Raven.captureException('Unknown avatar type', {
      extra: {actor},
    });
    return null;
  }
}

export default ActorAvatar;
