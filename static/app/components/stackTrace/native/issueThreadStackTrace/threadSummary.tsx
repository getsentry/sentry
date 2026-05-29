import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {ThreadSelector} from 'sentry/components/events/interfaces/threads/threadSelector';
import {getLockReason} from 'sentry/components/events/interfaces/threads/threadSelector/lockReason';
import {
  getMappedThreadState,
  getThreadStateHelpText,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {Pill} from 'sentry/components/pill';
import {Pills} from 'sentry/components/pills';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {TextOverflow} from 'sentry/components/textOverflow';
import {
  IconChevron,
  IconClock,
  IconInfo,
  IconLock,
  IconPlay,
  IconTimer,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

import {useActiveThread, useIssueThreadStackTraceContext} from './context';

function ThreadStateIcon({state}: {state: ThreadStates | undefined}) {
  if (state === null || state === undefined) {
    return null;
  }

  switch (state) {
    case ThreadStates.BLOCKED:
      return <IconLock locked />;
    case ThreadStates.TIMED_WAITING:
      return <IconTimer />;
    case ThreadStates.WAITING:
      return <IconClock />;
    case ThreadStates.RUNNABLE:
      return <IconPlay />;
    default:
      return <IconInfo />;
  }
}

export function ThreadSummary() {
  const {hasMoreThanOneThread} = useIssueThreadStackTraceContext();

  if (!hasMoreThanOneThread) {
    return null;
  }

  return (
    <Fragment>
      <Grid>
        <Container>
          <ThreadHeading>{t('Threads')}</ThreadHeading>
          <ThreadControls />
        </Container>
        <ThreadState />
      </Grid>
      <ThreadTags />
    </Fragment>
  );
}

function ThreadControls() {
  const activeThread = useActiveThread();
  const {activeThreadModel, changeThread, event, setActiveThread, threads} =
    useIssueThreadStackTraceContext();

  if (!activeThread) {
    return null;
  }

  return (
    <Flex justify="start" align="center" wrap="wrap" flexGrow={1} gap="md">
      <ButtonBar>
        <Button
          tooltipProps={{title: t('Previous Thread'), delay: 1000}}
          icon={<IconChevron direction="left" />}
          aria-label={t('Previous Thread')}
          size="xs"
          onClick={() => changeThread('previous')}
        />
        <Button
          tooltipProps={{title: t('Next Thread'), delay: 1000}}
          icon={<IconChevron direction="right" />}
          aria-label={t('Next Thread')}
          size="xs"
          onClick={() => changeThread('next')}
        />
      </ButtonBar>
      <ThreadSelector
        threads={threads}
        activeThread={activeThread}
        event={event}
        onChange={setActiveThread}
        exception={activeThreadModel.exception}
      />
    </Flex>
  );
}

function ThreadState() {
  const activeThread = useActiveThread();
  const threadStateDisplay = getMappedThreadState(activeThread?.state);
  const lockReason = getLockReason(activeThread?.heldLocks);

  if (!activeThread?.state) {
    return null;
  }

  return (
    <ThreadStateContainer>
      <ThreadHeading>{t('Thread State')}</ThreadHeading>
      <Flex align="center" gap="xs" position="relative">
        <ThreadStateIcon state={threadStateDisplay} />
        <TextOverflow>{threadStateDisplay}</TextOverflow>
        {threadStateDisplay && (
          <QuestionTooltip
            position="top"
            size="xs"
            containerDisplayMode="block"
            title={getThreadStateHelpText(threadStateDisplay)}
            skipWrapper
          />
        )}
        <LockReason>{lockReason}</LockReason>
      </Flex>
    </ThreadStateContainer>
  );
}

function ThreadTags() {
  const activeThread = useActiveThread();
  const threadStateDisplay = getMappedThreadState(activeThread?.state);
  const lockReason = getLockReason(activeThread?.heldLocks);

  if (activeThread?.id === undefined || !activeThread.name) {
    return null;
  }

  return (
    <Container>
      <ThreadHeading>{t('Thread Tags')}</ThreadHeading>
      <Pills>
        <Pill name={t('id')} value={activeThread.id} />
        {!!activeThread.name.trim() && (
          <Pill name={t('name')} value={activeThread.name} />
        )}
        {activeThread.current !== undefined && (
          <Pill name={t('was active')} value={activeThread.current} />
        )}
        {activeThread.crashed !== undefined && (
          <Pill name={t('errored')} value={activeThread.crashed} />
        )}
        {threadStateDisplay !== undefined && (
          <Pill name={t('state')} value={threadStateDisplay} />
        )}
        {defined(lockReason) && <Pill name={t('lock reason')} value={lockReason} />}
      </Pills>
    </Container>
  );
}

const Grid = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${p => p.theme.space.xl};
`;

const ThreadStateContainer = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LockReason = styled(TextOverflow)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
`;

const ThreadHeading = styled('h3')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.md};
`;
