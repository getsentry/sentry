import type decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import {Flex} from 'sentry/components/profiling/flex';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

type Mailbox = ReturnType<typeof decodeMailbox>;

interface Props {
  onChange: (next: Mailbox) => void;
  value: Mailbox;
}

const items = [
  {key: 'unresolved', label: t('Inbox')},
  {key: 'resolved', label: t('Resolved')},
  {key: 'ignored', label: t('Spam')},
];

export default function MailboxPicker({onChange, value}: Props) {
  const organization = useOrganization();
  const hasSpamFeature = organization.features.includes('user-feedback-spam-filter-ui');
  const children = hasSpamFeature ? items : items.filter(i => i.key !== 'ignored');
  return (
    <Flex justify="flex-end" flex="1 0 auto">
      <SegmentedControl
        size="xs"
        aria-label={t('Filter feedbacks')}
        value={value}
        onChange={onChange}
      >
        {children.map(c => (
          <SegmentedControl.Item key={c.key}>{c.label}</SegmentedControl.Item>
        ))}
      </SegmentedControl>
    </Flex>
  );
}
