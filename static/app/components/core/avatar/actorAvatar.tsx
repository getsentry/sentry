import type React from 'react';
import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import Placeholder from 'sentry/components/placeholder';
import type {Actor} from 'sentry/types/core';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeamsById} from 'sentry/utils/useTeamsById';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar';
import {TeamAvatar, type TeamAvatarProps} from './teamAvatar';
import {UserAvatar, type UserAvatarProps} from './userAvatar';

// Allows us to pass in an actor if we do not have any info aside from the ID
interface SimpleActor extends Omit<Actor, 'name'> {
  name?: string;
}

export interface ActorAvatarProps extends BaseAvatarProps {
  actor: SimpleActor;
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}

export function ActorAvatar({
  ref,
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
    return <AsyncMemberAvatar userActor={actor} {...otherProps} ref={ref} />;
  }

  if (actor.type === 'team') {
    return <AsyncTeamAvatar teamId={actor.id} {...otherProps} ref={ref} />;
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
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}

function AsyncTeamAvatar({ref, teamId, ...props}: AsyncTeamAvatarProps) {
  const {teams, isLoading} = useTeamsById({ids: [teamId]});
  const team = teams.find(t => t.id === teamId);

  if (isLoading) {
    const size = `${props.size}px`;
    return <Placeholder width={size} height={size} />;
  }

  return <TeamAvatar team={team} {...props} ref={ref} />;
}

/**
 * Wrapper to assist loading the user from api or store
 */
interface AsyncMemberAvatarProps extends Omit<UserAvatarProps, 'user'> {
  userActor: SimpleActor;
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}

function AsyncMemberAvatar({ref, userActor, ...props}: AsyncMemberAvatarProps) {
  const ids = useMemo(() => [userActor.id], [userActor.id]);
  const {members, fetching} = useMembers({ids});
  const member = members.find(u => u.id === userActor.id);

  if (fetching) {
    const size = `${props.size}px`;
    return <Placeholder shape="circle" width={size} height={size} />;
  }

  if (!member) {
    return (
      <BaseAvatar
        ref={ref}
        size={props.size}
        title={userActor.name ?? userActor.email}
        round
      />
    );
  }

  return <UserAvatar user={member} {...props} ref={ref} />;
}
