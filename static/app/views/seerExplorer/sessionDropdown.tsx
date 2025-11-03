import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconAdd, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useExplorerSessions} from 'sentry/views/seerExplorer/hooks/useExplorerSessions';
import type {ExplorerSession} from 'sentry/views/seerExplorer/types';

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
    textValue: session.title, // Used for search.
  };
}

interface SessionDropdownProps {
  activeRunId: number | null;
  onSelectSession: (runId: number | null) => void;
  organization: Organization | null;
  startNewSession: () => void;
  useExplorerSessionsResult: ReturnType<typeof useExplorerSessions>;
}

export function SessionDropdown({
  activeRunId,
  useExplorerSessionsResult,
  onSelectSession,
  startNewSession,
}: SessionDropdownProps) {
  const {sessions, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage} =
    useExplorerSessionsResult;

  const selectOptions = sessions.map(makeSelectOption);

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

  const menuFooter = (
    <Fragment>
      {hasNextPage && (
        <FooterWrapper>
          <Button
            size="xs"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            aria-label={t('Load more sessions')}
          >
            {isFetchingNextPage ? <LoadingIndicator size={12} /> : t('Load More')}
          </Button>
        </FooterWrapper>
      )}
    </Fragment>
  );

  const newSessionButton = activeRunId && (
    <NewSessionButton size="xs" onClick={startNewSession}>
      <Flex gap="2xs" align="center">
        <IconAdd size="xs" />
        {t('New')}
      </Flex>
    </NewSessionButton>
  );

  return (
    <CompactSelect
      key={activeRunId ?? 'new-session'} // Force re-render when runId changes.
      searchable
      menuWidth={350}
      position="bottom-start"
      value={activeRunId ?? undefined}
      menuTitle={
        isFetching && sessions.length === 0 ? t('Loading...') : t('Session History')
      }
      searchPlaceholder={t('Search sessions...')}
      size="sm"
      onChange={opt => {
        onSelectSession(opt.value ?? null);
      }}
      options={selectOptions}
      trigger={makeTrigger}
      emptyMessage={isFetching ? t('Loading sessions...') : t('No sessions found.')}
      menuFooter={menuFooter}
      menuHeaderTrailingItems={newSessionButton}
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

const NewSessionButton = styled(Button)`
  padding-top: 0;
  padding-bottom: 0;
  border: none;
  background: transparent;
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

const FooterWrapper = styled('div')`
  display: flex;
  justify-content: center;
`;
