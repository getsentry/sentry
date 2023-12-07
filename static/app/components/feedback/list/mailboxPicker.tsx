import decodeMailbox from 'sentry/components/feedback/decodeMailbox';
import {Flex} from 'sentry/components/profiling/flex';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';

type Mailbox = ReturnType<typeof decodeMailbox>;

interface Props {
  onChange: (next: Mailbox) => void;
  value: Mailbox;
}

export default function MailboxPicker({onChange, value}: Props) {
  return (
    <Flex justify="flex-end" flex="1 0 auto">
      <SegmentedControl
        size="xs"
        aria-label={t('Filter feedbacks')}
        value={value}
        onChange={onChange}
      >
        <SegmentedControl.Item key="unresolved">{t('Inbox')}</SegmentedControl.Item>
        <SegmentedControl.Item key="resolved">{t('Resolved')}</SegmentedControl.Item>
      </SegmentedControl>
    </Flex>
  );
}
