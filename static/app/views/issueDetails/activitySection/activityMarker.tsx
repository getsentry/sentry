import styled from '@emotion/styled';

import {SentryAppAvatar, UserAvatar} from '@sentry/scraps/avatar';

import type {GroupActivity} from 'sentry/types/group';

export function ActivityMarker({item, color}: {color: string; item: GroupActivity}) {
  if (item.sentry_app) {
    return (
      <AvatarMarker color={color}>
        <SentryAppAvatar
          data-test-id="sentry-app-activity-marker"
          sentryApp={item.sentry_app}
          size={22}
        />
      </AvatarMarker>
    );
  }
  if (item.user) {
    return (
      <AvatarMarker color={color}>
        <UserAvatar data-test-id="user-activity-marker" user={item.user} size={22} />
      </AvatarMarker>
    );
  }
  return <SentryMarker color={color} data-test-id="sentry-activity-marker" />;
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
