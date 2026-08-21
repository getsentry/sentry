import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';

/**
 * Compact last-seen / first-seen pair (e.g. `2d | 30d`), shared by the inbox
 * issue card and the issue preview header.
 */
export function IssueSeenTimes({group}: {group: Group}) {
  const lastSeen = group.lifetime?.lastSeen ?? group.lastSeen;
  const firstSeen = group.lifetime?.firstSeen ?? group.firstSeen;

  return (
    <Flex align="center" gap="xs" wrap="nowrap">
      <TimeSince
        date={lastSeen}
        suffix=""
        unitStyle="short"
        tooltipPrefix={t('Last Seen')}
        variant="muted"
      />
      <Text variant="muted">|</Text>
      <TimeSince
        date={firstSeen}
        suffix=""
        unitStyle="short"
        tooltipPrefix={t('First Seen')}
        variant="muted"
      />
    </Flex>
  );
}
