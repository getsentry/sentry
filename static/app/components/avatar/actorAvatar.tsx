import {Component} from 'react';
import * as Sentry from '@sentry/react';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Tooltip from 'sentry/components/tooltip';
import MemberListStore from 'sentry/stores/memberListStore';
import {Actor} from 'sentry/types';
import Teams from 'sentry/utils/teams';

type DefaultProps = {
  hasTooltip: boolean;
  size: number;
};

type Props = DefaultProps & {
  actor: Actor;
  className?: string;
  default?: string;
  gravatar?: boolean;
  onClick?: () => void;
  suggested?: boolean;
  title?: string;
  tooltip?: React.ReactNode;
  tooltipOptions?: Omit<React.ComponentProps<typeof Tooltip>, 'children' | 'title'>;
};

class ActorAvatar extends Component<Props> {
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
      return (
        <Teams ids={[actor.id]}>
          {({initiallyLoaded, teams}) =>
            initiallyLoaded ? (
              <TeamAvatar team={teams[0]} {...props} />
            ) : (
              <LoadingIndicator mini />
            )
          }
        </Teams>
      );
    }

    Sentry.withScope(scope => {
      scope.setExtra('actor', actor);
      Sentry.captureException(new Error('Unknown avatar type'));
    });

    return null;
  }
}

export default ActorAvatar;
