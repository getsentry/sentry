import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';

interface SessionSelectorDropdownProps {
  activeSessionId?: number;
  onSelectSession?: (runId: number) => void;
}

// Mock data for now - will be replaced with actual hook later
export const MOCK_SESSIONS: ExplorerSession[] = [
  {
    run_id: 1,
    title: 'Debug authentication issue in user login flow',
    created_at: '2025-01-15T10:30:00Z',
    last_triggered_at: '2025-01-15T12:45:00Z',
  },
  {
    run_id: 2,
    title: 'Investigate performance regression',
    created_at: '2025-01-15T09:15:00Z',
    last_triggered_at: '2025-01-15T11:20:00Z',
  },
  {
    run_id: 3,
    title: 'API endpoint returning 500 errors',
    created_at: '2025-01-14T16:45:00Z',
    last_triggered_at: '2025-01-14T18:30:00Z',
  },
  {
    run_id: 4,
    title: 'Memory leak in background worker',
    created_at: '2025-01-14T14:00:00Z',
    last_triggered_at: '2025-01-14T15:30:00Z',
  },
  {
    run_id: 5,
    title: 'Frontend bundle size optimization',
    created_at: '2025-01-13T11:20:00Z',
    last_triggered_at: '2025-01-13T13:45:00Z',
  },
  {
    run_id: 6,
    title: 'Database query optimization',
    created_at: '2025-01-12T15:30:00Z',
    last_triggered_at: '2025-01-12T16:00:00Z',
  },
];

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) {
    return 'Just now';
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffInMinutes / 1440);
  return `${days}d ago`;
}

function makeSelectOption(session: ExplorerSession): SelectOption<number> {
  const relativeTime = getRelativeTime(session.last_triggered_at);
  const createdDate = moment(session.created_at).format('MMM D');

  return {
    label: (
      <SessionOption>
        <SessionTitle>{session.title}</SessionTitle>
        <SessionMeta>
          {relativeTime} • Created {createdDate}
        </SessionMeta>
      </SessionOption>
    ),
    value: session.run_id,
    textValue: session.title,
  };
}

export function SessionSelectorDropdown({
  activeSessionId,
  onSelectSession,
}: SessionSelectorDropdownProps) {
  const selectOptions = MOCK_SESSIONS.map(makeSelectOption);

  const makeTrigger = (
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
  ) => {
    return (
      <TriggerButton {...props} aria-label="Select session">
        <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
      </TriggerButton>
    );
  };

  return (
    <CompactSelect
      searchable
      menuWidth={350}
      position="bottom-start"
      value={activeSessionId}
      menuTitle={t('Sessions')}
      searchPlaceholder={t('Search sessions...')}
      size="sm"
      onChange={opt => {
        if (opt?.value) {
          onSelectSession?.(opt.value);
        }
      }}
      options={selectOptions}
      trigger={makeTrigger}
      emptyMessage={t('No previous sessions')}
    />
  );
}

const TriggerButton = styled(Button)`
  display: flex;
  padding: ${space(0.75)} ${space(1.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  max-width: 300px;

  &:hover {
    background: ${p => p.theme.hover};
  }
`;

const SessionOption = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding: ${space(0.5)} 0;
  min-width: 0;
`;

const SessionTitle = styled(Text)`
  font-size: ${p => p.theme.fontSize.sm};
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SessionMeta = styled(Text)`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
`;
