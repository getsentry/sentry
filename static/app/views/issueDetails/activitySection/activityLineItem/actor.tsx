import styled from '@emotion/styled';

import {SentryAppAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {SEER_ACTIVITY_TYPES} from 'sentry/types/group';

export function ActivityLineActor({item}: {item: GroupActivity}) {
  return (
    <ActorSlot>
      <ActivityLineActorAvatar item={item} />
    </ActorSlot>
  );
}

function ActivityLineActorAvatar({item}: {item: GroupActivity}) {
  if (item.sentry_app) {
    return (
      <Tooltip title={item.sentry_app.name}>
        <SentryAppAvatar sentryApp={item.sentry_app} size={22} />
      </Tooltip>
    );
  }

  if (item.user) {
    return (
      <UserAvatar
        data-test-id="user-activity-actor"
        hasTooltip
        user={item.user}
        size={22}
      />
    );
  }

  if (SEER_ACTIVITY_TYPES.has(item.type)) {
    return (
      <Tooltip title={t('Seer')} skipWrapper>
        <SeerActor aria-label={t('Seer activity')} role="img">
          <IconSeer aria-hidden size="xs" />
        </SeerActor>
      </Tooltip>
    );
  }

  return null;
}

const ActorSlot = styled('div')`
  grid-column: 2;
  grid-row: 1;
  display: grid;
  place-items: center;
  min-width: 22px;
  min-height: 22px;
  margin-top: -2px;
`;

const SeerActor = styled('span')`
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: 100%;
  color: ${p => p.theme.tokens.content.secondary};
  background: ${p => p.theme.tokens.background.primary};
`;
