import React from 'react';
import Avatar from './avatar';
import {Actor} from '../proptypes';
import TeamAvatar from './teamAvatar';
import MemberListStore from '../stores/memberListStore';
import TeamStore from '../stores/teamStore';

let AvatarPropTypes = Avatar.propTypes;
delete AvatarPropTypes.user;

class ActorAvatar extends React.Component {
  static propTypes = {
    actor: Actor.isRequired,
    ...AvatarPropTypes,
  };

  render() {
    let {actor, ...props} = this.props;
    if (actor.type == 'user') {
      let user = MemberListStore.getById(actor.id);
      return <Avatar user={user} {...props} hasTooltip />;
    }
    if (actor.type == 'team') {
      let team = TeamStore.getById(actor.id);
      return <TeamAvatar team={team} {...props} hasTooltip />;
    }

    Raven.captureException('Unknown avatar type', {
      extra: {actor},
    });
    return null;
  }
}

export default ActorAvatar;
