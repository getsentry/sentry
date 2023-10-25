import {useState} from 'react';
import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  checked: string[];
  setQueryStatus: (status: string) => void;
  toggleChecked: (id: string) => void;
}

type Mailbox = 'inbox' | 'resolved' | 'archived';

export default function FeedbackListHeader({
  checked,
  toggleChecked,
  setQueryStatus,
}: Props) {
  const [mailbox, setMailbox] = useState<Mailbox>('inbox');

  return (
    <HeaderPanelItem>
      <Checkbox
        checked={checked.length ? 'indeterminate' : false}
        onChange={() => {
          checked.length ? checked.forEach(c => toggleChecked(c)) : null;
        }}
      />
      {checked.length ? (
        <HasSelection checked={checked} />
      ) : (
        <MailboxPicker
          value={mailbox}
          onChange={next => {
            setMailbox(next);
            next === 'inbox'
              ? setQueryStatus('unresolved')
              : next === 'resolved'
              ? setQueryStatus('resolved')
              : setQueryStatus('ignored');
          }}
        />
      )}
    </HeaderPanelItem>
  );
}

function HasSelection({checked}) {
  return (
    <Flex gap={space(1)} align="center" justify="space-between" style={{flexGrow: 1}}>
      <span>
        <strong>{tct('[count] Selected', {count: checked.length})}</strong>
      </span>
      <Flex gap={space(1)} justify="flex-end">
        <ErrorBoundary mini>
          <DropdownMenu
            position="bottom-end"
            triggerLabel="Unresolved"
            triggerProps={{
              'aria-label': t('Resolve or Archive Menu'),
              showChevron: true,
              size: 'xs',
            }}
            items={[
              {
                key: 'resolve',
                label: t('Resolve'),
                onAction: () => {},
              },
              {
                key: 'archive',
                label: t('Archive'),
                onAction: () => {},
              },
            ]}
          />
        </ErrorBoundary>
        <ErrorBoundary mini>
          <DropdownMenu
            position="bottom-end"
            triggerProps={{
              'aria-label': t('Read Menu'),
              icon: <IconEllipsis size="xs" />,
              showChevron: false,
              size: 'xs',
            }}
            items={[
              {
                key: 'mark read',
                label: t('Mark as read'),
                onAction: () => {},
              },
              {
                key: 'mark unread',
                label: t('Mark as unread'),
                onAction: () => {},
              },
            ]}
          />
        </ErrorBoundary>
      </Flex>
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
  padding: ${space(1)} ${space(2)} ${space(1)} ${space(2)};
  gap: ${space(1)};
  align-items: center;
`;
