import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import Placeholder from 'sentry/components/placeholder';
import type {Actor} from 'sentry/types/core';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import {Avatar, type AvatarProps} from './avatar';
import {TeamAvatar, type TeamAvatarProps} from './teamAvatar';
import {UserAvatar, type UserAvatarProps} from './userAvatar';

// Allows us to pass in an actor if we do not have any info aside from the ID
interface SimpleActor extends Omit<Actor, 'name'> {
  name?: string;
}

export interface ActorAvatarProps extends Omit<AvatarProps, 'round'> {
  actor: SimpleActor;
}

export function ActorAvatar({
  size = 24,
  hasTooltip = true,
  actor,
  ...props
}: ActorAvatarProps) {
  const otherProps = {
    size,
    hasTooltip,
    ...props,
  };

  if (actor.type === 'user') {
    return <AsyncMemberAvatar actor={actor} {...otherProps} />;
  }

  if (actor.type === 'team') {
    return <AsyncTeamAvatar teamId={actor.id} {...otherProps} />;
  }

  Sentry.withScope(scope => {
    scope.setExtra('actor', actor);
    Sentry.captureException(new Error('Unknown avatar type'));
  });

  return null;
}

/**
 * Wrapper to assist loading the team from api or store
 */

interface AsyncTeamAvatarProps extends Omit<TeamAvatarProps, 'team'> {
  teamId: string;
}

function AsyncTeamAvatar({teamId, ...props}: AsyncTeamAvatarProps) {
  const {teams, isLoading} = useTeamsById({ids: [teamId]});
  const team = teams.find(t => t.id === teamId);

  if (isLoading) {
    return <Placeholder width={`${props.size}px`} height={`${props.size}px`} />;
  }

  if (!team) {
    return <Avatar type="letter_avatar" name={teamId} identifier={teamId} {...props} />;
  }

  return <TeamAvatar team={team} {...props} />;
}

/**
 * Wrapper to assist loading the user from api or store
 */
interface AsyncMemberAvatarProps extends Omit<UserAvatarProps, 'user' | 'round'> {
  actor: SimpleActor;
}

function AsyncMemberAvatar({actor, ...props}: AsyncMemberAvatarProps) {
  const ids = useMemo(() => [actor.id], [actor.id]);
  const {members, fetching} = useMembers({ids});
  const member = members.find(u => u.id === actor.id);

  if (fetching) {
    const size = `${props.size}px`;
    return <Placeholder shape="circle" width={size} height={size} />;
  }

  if (!member) {
    return (
      <Avatar
        {...props}
        type="letter_avatar"
        name={actor.name ?? actor.email ?? actor.id}
        identifier={actor.id}
        round
      />
    );
  }

  return <UserAvatar user={member} {...props} />;
}
