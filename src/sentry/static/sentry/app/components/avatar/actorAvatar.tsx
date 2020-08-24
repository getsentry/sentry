import React from 'react';
import * as Sentry from '@sentry/react';

import TeamAvatar from 'app/components/avatar/teamAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';
import Tooltip from 'app/components/tooltip';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';
import {Actor} from 'app/types';

type DefaultProps = {
  hasTooltip: boolean;
  size: number;
};

type Props = DefaultProps & {
  actor: Actor;
  default?: string;
  title?: string;
  gravatar?: boolean;
  className?: string;
  onClick?: () => void;
  suggested?: boolean;
  tooltip?: React.ReactNode;
  tooltipOptions?: Omit<Tooltip['props'], 'children' | 'title'>;
};

class ActorAvatar extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    size: 24,
    hasTooltip: true,
  };

  render() {
    const {actor, ...props} = this.props;

    if (actor.type === 'user') {
      const user = actor.id ? MemberListStore.getById(actor.id) ?? actor : actor;
      return <UserAvatar user={user} {...props} />;
    }

    if (actor.type === 'team') {
      const team = TeamStore.getById(actor.id);
      return <TeamAvatar team={team} {...props} />;
    }

    Sentry.withScope(scope => {
      scope.setExtra('actor', actor);
      Sentry.captureException(new Error('Unknown avatar type'));
    });

    return null;
  }
}

export default ActorAvatar;
