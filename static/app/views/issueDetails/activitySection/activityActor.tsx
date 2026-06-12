import styled from '@emotion/styled';

import {SentryAppAvatar, UserAvatar} from '@sentry/scraps/avatar';

import type {Actor} from 'sentry/types/core';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {User} from 'sentry/types/user';

export type ActivityActor =
  | {
      name: string;
      sentryApp: NonNullable<GroupActivity['sentry_app']>;
      type: 'sentry-app';
    }
  | {name: string; type: 'user'; user: Actor | User}
  | {name: string; type: 'external'}
  | {name: string; type: 'system'};

export function getActivityActor(item: GroupActivity): ActivityActor {
  if (item.sentry_app) {
    return {type: 'sentry-app', name: item.sentry_app.name, sentryApp: item.sentry_app};
  }
  if (item.user) {
    return {type: 'user', name: item.user.name, user: item.user};
  }

  if (item.type === GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST) {
    const author = item.data.pullRequest?.author;

    if (!author?.name || author.email?.endsWith('@localhost')) {
      return {type: 'system', name: 'Sentry'};
    }

    const {name} = author;

    if ('id' in author) {
      const user: Actor = {
        id: String(author.id),
        name,
        type: 'user',
        email: author.email,
      };

      return {type: 'user', name, user};
    }

    return {type: 'external', name};
  }

  return {type: 'system', name: 'Sentry'};
}

interface ActivityActorMarkerProps {
  actor: ActivityActor;
  color: string;
}

export function ActivityActorMarker({actor, color}: ActivityActorMarkerProps) {
  if (actor.type === 'sentry-app') {
    return (
      <AvatarMarker color={color}>
        <SentryAppAvatar
          data-test-id="sentry-app-activity-marker"
          sentryApp={actor.sentryApp}
          size={22}
        />
      </AvatarMarker>
    );
  }
  if (actor.type === 'user') {
    return (
      <AvatarMarker color={color}>
        <UserAvatar data-test-id="user-activity-marker" user={actor.user} size={22} />
      </AvatarMarker>
    );
  }
  return <SentryMarker color={color} data-test-id="sentry-activity-marker" />;
}

interface ActivityActorIconProps {
  actor: ActivityActor;
  fallback?: React.ReactNode;
}

export function ActivityActorIcon({actor, fallback = null}: ActivityActorIconProps) {
  if (actor.type === 'sentry-app') {
    return <SentryAppAvatar sentryApp={actor.sentryApp} />;
  }
  if (actor.type === 'user') {
    return <StyledUserAvatar user={actor.user} />;
  }
  return fallback;
}

const AvatarMarker = styled('span')<{color: string}>`
  display: block;
  position: relative;
  border-radius: 100%;
  line-height: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 100%;
    box-shadow: inset 0 0 0 2px ${p => p.color};
    pointer-events: none;
  }
`;

const SentryMarker = styled('span')<{color: string}>`
  width: 12px;
  height: 12px;
  border-radius: 100%;
  background: ${p => p.theme.tokens.background.primary};
  display: grid;
  place-items: center;

  &::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 100%;
    background: ${p => p.color};
  }
`;

const StyledUserAvatar = styled(UserAvatar)`
  svg {
    margin: ${p => p.theme.space['2xs']};
  }
`;
