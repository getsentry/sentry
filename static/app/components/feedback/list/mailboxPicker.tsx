import Badge from 'sentry/components/badge';
import type decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import useMailboxCounts from 'sentry/components/feedback/list/useMailboxCounts';
import {Flex} from 'sentry/components/profiling/flex';
import {SegmentedControl} from 'sentry/components/segmentedControl';
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

  const hasSpamFeature = organization.features.includes('user-feedback-spam-filter-ui');
  const filteredMailboxes = hasSpamFeature
    ? MAILBOXES
    : MAILBOXES.filter(i => i.key !== 'ignored');

  return (
    <Flex justify="flex-end" flex="1 0 auto">
      <SegmentedControl
        size="xs"
        aria-label={t('Filter feedbacks')}
        value={value}
        onChange={onChange}
      >
        {filteredMailboxes.map(c => (
          <SegmentedControl.Item key={c.key}>
            <Flex align="center">
              {c.label}
              {data?.[c.key] ? <Badge type="purple" text={data?.[c.key] ?? ''} /> : null}
            </Flex>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl>
    </Flex>
  );
}
