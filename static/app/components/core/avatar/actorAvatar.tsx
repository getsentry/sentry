import type React from 'react';
import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import {TeamAvatar, type TeamAvatarProps} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar, type UserAvatarProps} from 'sentry/components/core/avatar/userAvatar';
import Placeholder from 'sentry/components/placeholder';
import type {Actor} from 'sentry/types/core';
import {useMembers} from 'sentry/utils/useMembers';
import {useTeamsById} from 'sentry/utils/useTeamsById';

export interface ActorAvatarProps extends BaseAvatarProps {
  actor: Actor;
}

export function ActorAvatar({
  ref,
  size = 24,
  hasTooltip = true,
  actor,
  ...props
}: ActorAvatarProps & {
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}) {
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
}

function AsyncTeamAvatar({
  ref,
  teamId,
  ...props
}: AsyncTeamAvatarProps & {
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}) {
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
  userActor: Actor;
}

function AsyncMemberAvatar({
  ref,
  userActor,
  ...props
}: AsyncMemberAvatarProps & {
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
}) {
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
