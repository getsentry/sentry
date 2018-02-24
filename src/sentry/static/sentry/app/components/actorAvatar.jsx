import PropTypes from 'prop-types';
import React from 'react';
import Avatar from './avatar';
import {Actor} from '../proptypes';
import TeamAvatar from './teamAvatar';
import MemberListStore from '../stores/memberListStore';
import TeamStore from '../stores/teamStore';

class ActorAvatar extends React.Component {
  static propTypes = {
    actor: Actor,
    size: PropTypes.number,
    default: PropTypes.string,
    title: PropTypes.string,
    gravatar: PropTypes.bool,
  };

  render() {
    let {actor, ...props} = this.props;
    if (actor.type == 'user') {
      let user = MemberListStore.getById(actor.id);
      return <Avatar user={user} {...props} />;
    }
    if (actor.type == 'team') {
      let team = TeamStore.getById(actor.id);
      return <TeamAvatar team={team} {...props} />;
    }
    Raven.captureException('Unknown type');
    return <div>Unknown Type</div>;
  }
}

export default ActorAvatar;
