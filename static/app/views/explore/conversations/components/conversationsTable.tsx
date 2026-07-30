import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';
import type {ConversationUser} from 'sentry/views/explore/conversations/hooks/useConversations';

export function normalizeUserField(value: string | null | undefined): string | null {
  if (!value || value.toLowerCase() === 'none') {
    return null;
  }
  return value;
}

export function getUserDisplayName(user: ConversationUser): string | null {
  return (
    normalizeUserField(user.email) ||
    normalizeUserField(user.username) ||
    normalizeUserField(user.ip_address) ||
    null
  );
}

export const CELL_MAX_CHARS = 256;

export function UserNotInstrumentedTooltip() {
  return (
    <Text>
      {tct(
        'User data not found. Call [code:sentry.setUser()] in your SDK to track users. [link:Learn more]',
        {
          code: <code />,
          link: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/apis/#setUser" />
          ),
        }
      )}
    </Text>
  );
}
