import {Fragment} from 'react';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

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
import {
  IconChevron,
  IconClock,
  IconInfo,
  IconLock,
  IconPlay,
  IconTimer,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

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
  const {threads} = useIssueThreadStackTraceContext();

  if (threads.length <= 1) {
    return null;
  }

  return (
    <Fragment>
      <Grid columns="auto 1fr" gap="xl">
        <Stack gap="md">
          <ThreadHeading>{t('Threads')}</ThreadHeading>
          <ThreadControls />
        </Stack>
        <ThreadState />
      </Grid>
      <ThreadTags />
    </Fragment>
  );
}

function ThreadHeading({children}: {children: React.ReactNode}) {
  return (
    <Heading as="h3" size="md" variant="secondary">
      {children}
    </Heading>
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
    <Stack gap="md" minWidth="0">
      <ThreadHeading>{t('Thread State')}</ThreadHeading>
      <Flex align="center" gap="xs" minWidth="0">
        <ThreadStateIcon state={threadStateDisplay} />
        <Text ellipsis>{threadStateDisplay}</Text>
        {threadStateDisplay && (
          <QuestionTooltip
            position="top"
            size="xs"
            containerDisplayMode="block"
            title={getThreadStateHelpText(threadStateDisplay)}
            skipWrapper
          />
        )}
        {lockReason ? (
          <Text variant="secondary" ellipsis>
            {lockReason}
          </Text>
        ) : null}
      </Flex>
    </Stack>
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
    <Stack gap="md">
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
          <Pill name={t('errored')}>{activeThread.crashed ? t('yes') : t('no')}</Pill>
        )}
        {threadStateDisplay !== undefined && (
          <Pill name={t('state')} value={threadStateDisplay} />
        )}
        {defined(lockReason) && <Pill name={t('lock reason')} value={lockReason} />}
      </Pills>
    </Stack>
  );
}
