import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import Placeholder from 'sentry/components/placeholder';
import type {Actor} from 'sentry/types/core';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar';

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
    const size = `${props.size}px`;
    return <Placeholder width={size} height={size} />;
  }

  return <TeamAvatar team={team} {...props} />;
}

/**
 * Wrapper to assist loading the user from api or store
 */
function LoadMemberAvatar({
  userActor,
  ...props
}: {userActor: Actor} & Omit<React.ComponentProps<typeof UserAvatar>, 'team'>) {
  const ids = useMemo(() => [userActor.id], [userActor.id]);
  const {members, fetching} = useMembers({ids});
  const member = members.find(u => u.id === userActor.id);

  if (fetching) {
    const size = `${props.size}px`;
    return <Placeholder shape="circle" width={size} height={size} />;
  }

  if (!member) {
    return (
      <BaseAvatar size={props.size} title={userActor.name ?? userActor.email} round />
    );
  }

  return <UserAvatar user={member} {...props} />;
}

function ActorAvatar({size = 24, hasTooltip = true, actor, ...props}: Props) {
  const otherProps = {
    size,
    hasTooltip,
    ...props,
  };

  if (actor.type === 'user') {
    return <LoadMemberAvatar userActor={actor} {...otherProps} />;
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
