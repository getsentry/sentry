import {useTheme} from '@emotion/react';

import {Badge} from 'sentry/components/core/badge';
import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Tooltip} from 'sentry/components/core/tooltip';
import type decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import useMailboxCounts from 'sentry/components/feedback/list/useMailboxCounts';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

type Mailbox = ReturnType<typeof decodeMailbox>;

interface Props {
  onChange: (next: Mailbox) => void;
  value: Mailbox;
}

const MAILBOXES = [
  {key: 'unresolved', label: t('Inbox')},
  {key: 'resolved', label: t('Resolved')},
  {key: 'ignored', label: t('Spam')},
];

export default function MailboxPicker({onChange, value}: Props) {
  const organization = useOrganization();
  const {data} = useMailboxCounts({organization});
  const theme = useTheme();

  const filteredMailboxes = MAILBOXES;

  return (
    <Flex justify="flex-end" flex="1 0 auto">
      <SegmentedControl
        size="xs"
        aria-label={t('Filter feedbacks')}
        value={value}
        onChange={onChange}
      >
        {filteredMailboxes.map(mailbox => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          const count = data?.[mailbox.key];
          const display = count && count >= 100 ? '99+' : count;
          const title =
            count === 1 ? t('1 unassigned item') : t('%s unassigned items', display);
          return (
            <SegmentedControl.Item key={mailbox.key} aria-label={mailbox.label}>
              <Tooltip disabled={!count} title={title}>
                <Flex align="center" gap={theme.isChonk ? space(0.75) : 0}>
                  {mailbox.label}
                  {display ? <Badge type="default">{display}</Badge> : null}
                </Flex>
              </Tooltip>
            </SegmentedControl.Item>
          );
        })}
      </SegmentedControl>
    </Flex>
  );
}
