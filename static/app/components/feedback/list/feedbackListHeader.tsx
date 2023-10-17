import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArchive} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  checked: string[];
}

type Mailbox = 'inbox' | 'resolved' | 'archived';

export default function FeedbackListHeader({checked}: Props) {
  const [mailbox, setMailbox] = useState<Mailbox>('inbox');

  return (
    <HeaderPanelItem>
      <Checkbox />
      {checked.length ? (
        <HasSelection checked={checked} />
      ) : (
        <MailboxPicker value={mailbox} onChange={setMailbox} />
      )}
    </HeaderPanelItem>
  );
}

function HasSelection({checked}) {
  return (
    <Flex gap={space(1)} align="center" justify="space-between" style={{flexGrow: 1}}>
      <span>
        {t('checked')} = {checked.length}
      </span>

      <Tooltip title={t('Coming soon')}>
        <Button disabled priority="primary" size="xs" icon={<IconArchive size="xs" />}>
          {t('Resolve')}
        </Button>
      </Tooltip>
    </Flex>
  );
}

function MailboxPicker({
  onChange,
  value,
}: {
  onChange: (next: Mailbox) => void;
  value: Mailbox;
}) {
  return (
    <Flex justify="flex-end" style={{flexGrow: 1}}>
      <Tooltip title={t('Coming soon')}>
        <SegmentedControl
          size="xs"
          aria-label={t('Filter feedbacks')}
          value={value}
          onChange={onChange}
        >
          <SegmentedControl.Item key="inbox">{t('Inbox')}</SegmentedControl.Item>
          <SegmentedControl.Item key="resolved">{t('Resolved')}</SegmentedControl.Item>
          <SegmentedControl.Item key="archived">{t('Archived')}</SegmentedControl.Item>
        </SegmentedControl>
      </Tooltip>
    </Flex>
  );
}

const HeaderPanelItem = styled(PanelItem)`
  display: flex;
  padding: ${space(1)} ${space(0.5)} ${space(1)} ${space(1.5)};
  gap: ${space(1)};
  align-items: center;
`;
