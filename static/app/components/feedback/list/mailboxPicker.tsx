import {Flex} from 'sentry/components/container/flex';
import {Badge} from 'sentry/components/core/badge';
import type decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import useMailboxCounts from 'sentry/components/feedback/list/useMailboxCounts';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
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

  const filteredMailboxes = MAILBOXES;

  return (
    <Flex justify="flex-end" flex="1 0 auto">
      <SegmentedControl
        size="xs"
        aria-label={t('Filter feedbacks')}
        value={value}
        onChange={onChange}
      >
        {filteredMailboxes.map(c => {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          const count = data?.[c.key];
          const display = count && count >= 100 ? '99+' : count;
          const title =
            count === 1 ? t('1 unassigned item') : t('%s unassigned items', display);
          return (
            <SegmentedControl.Item key={c.key} aria-label={c.label}>
              <Tooltip disabled={!count} title={title}>
                <Flex align="center">
                  {c.label}
                  {display ? <Badge type="gray">{display}</Badge> : null}
                </Flex>
              </Tooltip>
            </SegmentedControl.Item>
          );
        })}
      </SegmentedControl>
    </Flex>
  );
}
