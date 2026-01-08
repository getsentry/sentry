import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import type {ConversationUser} from 'sentry/views/insights/pages/conversations/hooks/useConversations';

interface ConversationUserCellProps {
  user: ConversationUser | null;
}

/**
 * Get a display name from user data with fallback priority:
 * email > username > ip_address > "Unknown"
 */
function getUserDisplayName(user: ConversationUser): string {
  return user.email || user.username || user.ip_address || t('Unknown');
}

function UserNotInstrumentedTooltip() {
  return (
    <Flex direction="column" gap="xs">
      <Text>
        {tct(
          'User data not found. Call [code:sentry.setUser()] in your SDK to track users.',
          {
            code: <code />,
          }
        )}
      </Text>
    </Flex>
  );
}

export function ConversationUserCell({user}: ConversationUserCellProps) {
  if (!user) {
    return (
      <Tooltip title={<UserNotInstrumentedTooltip />}>
        <Text variant="muted">&mdash;</Text>
      </Tooltip>
    );
  }

  const displayName = getUserDisplayName(user);

  return (
    <Flex align="center">
      <Tooltip title={displayName} showOnlyOnOverflow>
        <Text ellipsis>{displayName}</Text>
      </Tooltip>
    </Flex>
  );
}
