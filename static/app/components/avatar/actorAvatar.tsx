import * as Sentry from '@sentry/react';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MemberListStore from 'sentry/stores/memberListStore';
import type {Actor} from 'sentry/types';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import {BaseAvatarProps} from './baseAvatar';

interface Props extends BaseAvatarProps {
  actor: Actor;
}

/**
 * Wrapper to assist loading the team from api or store
 */
function LoadTeamAvatar({
  teamId,
  ...props
}: {teamId: string} & Omit<React.ComponentProps<typeof TeamAvatar>, 'team'>) {
  const {teams, isLoading} = useTeamsById({ids: [teamId]});
  const team = teams.find(t => t.id === teamId);

  if (isLoading) {
    return <LoadingIndicator mini />;
  }

  return <TeamAvatar team={team} {...props} />;
}

function ActorAvatar({size = 24, hasTooltip = true, actor, ...props}: Props) {
  const otherProps = {
    size,
    hasTooltip,
    ...props,
  };

  if (actor.type === 'user') {
    const user = actor.id ? MemberListStore.getById(actor.id) ?? actor : actor;
    return <UserAvatar user={user} {...otherProps} />;
  }

  if (actor.type === 'team') {
    return <LoadTeamAvatar teamId={actor.id} {...otherProps} />;
  }

  Sentry.withScope(scope => {
    scope.setExtra('actor', actor);
    Sentry.captureException(new Error('Unknown avatar type'));
  });

  return null;
}

export default ActorAvatar;
