import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/browser';

import Avatar from 'app/components/avatar';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';
import {Actor} from 'app/sentryTypes';

class ActorAvatar extends React.Component {
  static propTypes = {
    actor: Actor.isRequired,
    size: PropTypes.number,
    default: PropTypes.string,
    title: PropTypes.string,
    gravatar: PropTypes.bool,
  };

  render() {
    const {actor, ...props} = this.props;

    if (actor.type === 'user') {
      const user = actor.id ? MemberListStore.getById(actor.id) : actor;
      return <Avatar user={user} hasTooltip {...props} />;
    }

    if (actor.type === 'team') {
      const team = TeamStore.getById(actor.id);
      return <Avatar team={team} hasTooltip {...props} />;
    }

    Sentry.withScope(scope => {
      scope.setExtra('actor', actor);
      Sentry.captureException(new Error('Unknown avatar type'));
    });

    return null;
  }
}

export default ActorAvatar;
