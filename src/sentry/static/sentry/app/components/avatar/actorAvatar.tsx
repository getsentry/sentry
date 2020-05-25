import React from 'react';
import PropTypes from 'prop-types';
import * as Sentry from '@sentry/browser';

import SentryTypes from 'app/sentryTypes';
import UserAvatar from 'app/components/avatar/userAvatar';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';
import {Actor} from 'app/types';

type Props = {
  actor: Actor;
  size?: number;
  default?: string;
  title?: string;
  gravatar?: boolean;
  className?: string;
  hasTooltip?: boolean;
  onClick?: () => void;
};

class ActorAvatar extends React.Component<Props> {
  static propTypes = {
    actor: SentryTypes.Actor.isRequired,
    size: PropTypes.number,
    default: PropTypes.string,
    title: PropTypes.string,
    gravatar: PropTypes.bool,
  };

  render() {
    const {actor, hasTooltip = true, ...props} = this.props;

    if (actor.type === 'user') {
      const user = actor.id ? MemberListStore.getById(actor.id) : actor;
      return <UserAvatar user={user} hasTooltip={hasTooltip} {...props} />;
    }

    if (actor.type === 'team') {
      const team = TeamStore.getById(actor.id);
      return <TeamAvatar team={team} hasTooltip={hasTooltip} {...props} />;
    }

    Sentry.withScope(scope => {
      scope.setExtra('actor', actor);
      Sentry.captureException(new Error('Unknown avatar type'));
    });

    return null;
  }
}

export default ActorAvatar;
