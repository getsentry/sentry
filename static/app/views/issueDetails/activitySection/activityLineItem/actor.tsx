import {IconSeer} from '@sentry/icons/seer';

import {SentryAppAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType, SEER_ACTIVITY_TYPES} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';

import {
  ActivitySourceLogo,
  getActivitySource,
  type ActivitySource,
} from './activitySource';

export function renderActivityLineActor(item: GroupActivity): React.ReactElement | null {
  if (item.sentry_app) {
    if (item.type !== GroupActivityType.NOTE) {
      return null;
    }

    return (
      <Tooltip title={item.sentry_app.name}>
        <SentryAppAvatar sentryApp={item.sentry_app} size={22} />
      </Tooltip>
    );
  }

  const source = getActivitySource(item);

  if (item.user) {
    return source ? (
      <UserWithSource user={item.user} source={source} />
    ) : (
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
        <Flex
          as="span"
          align="center"
          aria-label={t('Seer activity')}
          background="primary"
          border="secondary"
          display="inline-flex"
          height="22px"
          justify="center"
          radius="full"
          role="img"
          width="22px"
        >
          <IconSeer aria-hidden size="xs" variant="secondary" />
        </Flex>
      </Tooltip>
    );
  }

  if (source) {
    return <ActivitySourceLogo source={source} hasTooltip />;
  }

  return null;
}

/**
 * A 20px avatar with the 16px source logo tucked 4px behind it. Wider than the
 * marker column, so it's shifted 5px left for the timeline to pass where the
 * logo meets the avatar.
 */
function UserWithSource({user, source}: {source: ActivitySource; user: User}) {
  return (
    <Tooltip
      title={
        <Stack gap="2xs">
          <Text size="sm" bold>
            {userDisplayName(user)}
          </Text>
          <Text size="sm" variant="muted">
            {source.description}
          </Text>
        </Stack>
      }
      skipWrapper
    >
      <Flex
        as="span"
        align="center"
        position="relative"
        left="-5px"
        width="32px"
        height="20px"
      >
        <Container as="span" display="inline-flex" position="absolute" right="0">
          <ActivitySourceLogo source={source} />
        </Container>
        {/* After the logo so it paints over the tucked edge */}
        <Container as="span" display="inline-flex" position="relative">
          <UserAvatar data-test-id="user-activity-actor" user={user} size={20} />
        </Container>
      </Flex>
    </Tooltip>
  );
}
