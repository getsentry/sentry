import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CommitRow} from 'sentry/components/commitRow';
import {Flex} from 'sentry/components/container/flex';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {getLockReason} from 'sentry/components/events/interfaces/threads/threadSelector/lockReason';
import {
  getMappedThreadState,
  getThreadStateHelpText,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {SuspectCommits} from 'sentry/components/events/suspectCommits';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {
  IconChevron,
  IconClock,
  IconInfo,
  IconLock,
  IconPlay,
  IconTimer,
} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {StackType, StackView} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import {TraceEventDataSection} from '../traceEventDataSection';

import {ExceptionContent} from './crashContent/exception';
import {StackTraceContent} from './crashContent/stackTrace';
import ThreadSelector from './threads/threadSelector';
import findBestThread from './threads/threadSelector/findBestThread';
import getThreadException from './threads/threadSelector/getThreadException';
import getThreadStacktrace from './threads/threadSelector/getThreadStacktrace';
import NoStackTraceMessage from './noStackTraceMessage';
import {inferPlatform, isStacktraceNewestFirst} from './utils';

type ExceptionProps = React.ComponentProps<typeof ExceptionContent>;

type Props = Pick<ExceptionProps, 'groupingCurrentLevel'> & {
  data: {
    values?: Array<Thread>;
  };
  event: Event;
  group: Group | undefined;
  projectSlug: Project['slug'];
};

function getIntendedStackView(
  thread: Thread,
  exception: ReturnType<typeof getThreadException>
): StackView {
  if (exception) {
    return exception.values.find(value => !!value.stacktrace?.hasSystemFrames)
      ? StackView.APP
      : StackView.FULL;
  }

  const stacktrace = getThreadStacktrace(false, thread);

  return stacktrace?.hasSystemFrames ? StackView.APP : StackView.FULL;
}

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

// We want to set the active thread every time the event changes because the best thread might not be the same between events
const useActiveThreadState = (
  event: Event,
  threads: Thread[]
): [Thread | undefined, (newState: Thread | undefined) => void] => {
  const bestThread = threads.length ? findBestThread(threads) : undefined;

  const [activeThread, setActiveThread] = useState<Thread | undefined>(() => bestThread);

  useEffect(() => {
    setActiveThread(bestThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  return [activeThread, setActiveThread];
};

export function Threads({data, event, projectSlug, groupingCurrentLevel, group}: Props) {
  // Sort threads by crashed first
  const threads = useMemo(
    () => (data.values ?? []).toSorted((a, b) => Number(b.crashed) - Number(a.crashed)),
    [data.values]
  );
  const hasStreamlinedUI = useHasStreamlinedUI();
  const [activeThread, setActiveThread] = useActiveThreadState(event, threads);

  const stackTraceNotFound = !threads.length;

  const hasMoreThanOneThread = threads.length > 1;

  const exception = useMemo(
    () => getThreadException(event, activeThread),
    [event, activeThread]
  );

  const entryIndex = exception
    ? event.entries.findIndex(entry => entry.type === EntryType.EXCEPTION)
    : event.entries.findIndex(entry => entry.type === EntryType.THREADS);

  const meta = event._meta?.entries?.[entryIndex]?.data?.values;

  const stackView = activeThread
    ? getIntendedStackView(activeThread, exception)
    : undefined;

  function renderPills() {
    const {
      id,
      name,
      current,
      crashed,
      state: threadState,
      heldLocks,
    } = activeThread ?? {};

    if (id === null || id === undefined || !name) {
      return null;
    }

    const threadStateDisplay = getMappedThreadState(threadState);
    const lockReason = getLockReason(heldLocks);

    return (
      <Pills>
        <Pill name={t('id')} value={id} />
        {!!name?.trim() && <Pill name={t('name')} value={name} />}
        {current !== undefined && <Pill name={t('was active')} value={current} />}
        {crashed !== undefined && (
          <Pill name={t('errored')} className={crashed ? 'false' : 'true'}>
            {crashed ? t('yes') : t('no')}
          </Pill>
        )}
        {threadStateDisplay !== undefined && (
          <Pill name={t('state')} value={threadStateDisplay} />
        )}
        {defined(lockReason) && <Pill name={t('lock reason')} value={lockReason} />}
      </Pills>
    );
  }

  function renderContent({
    display,
    recentFirst,
    fullStackTrace,
  }: Parameters<React.ComponentProps<typeof TraceEventDataSection>['children']>[0]) {
    const stackType = display.includes('minified')
      ? StackType.MINIFIED
      : StackType.ORIGINAL;

    if (exception) {
      return (
        <ExceptionContent
          stackType={stackType}
          stackView={
            display.includes('raw-stack-trace')
              ? StackView.RAW
              : fullStackTrace
                ? StackView.FULL
                : StackView.APP
          }
          projectSlug={projectSlug}
          newestFirst={recentFirst}
          event={event}
          values={exception.values}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          threadId={activeThread?.id}
        />
      );
    }

    const stackTrace = getThreadStacktrace(
      stackType !== StackType.ORIGINAL,
      activeThread
    );

    if (stackTrace) {
      return (
        <StackTraceContent
          stacktrace={stackTrace}
          stackView={
            display.includes('raw-stack-trace')
              ? StackView.RAW
              : fullStackTrace
                ? StackView.FULL
                : StackView.APP
          }
          newestFirst={recentFirst}
          event={event}
          platform={platform}
          groupingCurrentLevel={groupingCurrentLevel}
          meta={meta}
          threadId={activeThread?.id}
        />
      );
    }

    return (
      <NoStackTraceMessage
        message={activeThread?.crashed ? t('Thread Errored') : undefined}
      />
    );
  }

  const platform = inferPlatform(event, activeThread);
  const threadStateDisplay = getMappedThreadState(activeThread?.state);

  const {id: activeThreadId, name: activeThreadName} = activeThread ?? {};
  const hideThreadTags = activeThreadId === undefined || !activeThreadName;

  function handleChangeThread(direction: 'previous' | 'next') {
    const currentIndex = threads.findIndex(thread => thread.id === activeThreadId);
    let nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) {
      nextIndex = threads.length - 1;
    } else if (nextIndex >= threads.length) {
      nextIndex = 0;
    }

    setActiveThread(threads[nextIndex]);
  }

  const threadComponent = (
    <Fragment>
      {hasMoreThanOneThread && (
        <Fragment>
          <Grid>
            <div>
              <ThreadHeading>{t('Threads')}</ThreadHeading>
              {activeThread && (
                <Wrapper>
                  <ButtonBar merged>
                    <Button
                      title={t('Previous Thread')}
                      tooltipProps={{delay: 1000}}
                      icon={<IconChevron direction="left" />}
                      aria-label={t('Previous Thread')}
                      size="xs"
                      onClick={() => {
                        handleChangeThread('previous');
                      }}
                    />
                    <Button
                      title={t('Next Thread')}
                      tooltipProps={{delay: 1000}}
                      icon={<IconChevron direction="right" />}
                      aria-label={t('Next Thread')}
                      size="xs"
                      onClick={() => {
                        handleChangeThread('next');
                      }}
                    />
                  </ButtonBar>
                  <ThreadSelector
                    threads={threads}
                    activeThread={activeThread}
                    event={event}
                    onChange={thread => {
                      setActiveThread(thread);
                    }}
                    exception={exception}
                  />
                </Wrapper>
              )}
            </div>
            {activeThread?.state && (
              <TheadStateContainer>
                <ThreadHeading>{t('Thread State')}</ThreadHeading>
                <ThreadStateWrapper>
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
                  <LockReason>{getLockReason(activeThread?.heldLocks)}</LockReason>
                </ThreadStateWrapper>
              </TheadStateContainer>
            )}
          </Grid>
          {!hideThreadTags && (
            <div>
              <ThreadHeading>{t('Thread Tags')}</ThreadHeading>
              {renderPills()}
            </div>
          )}
        </Fragment>
      )}
      <TraceEventDataSection
        type={SectionKey.THREADS}
        projectSlug={projectSlug}
        eventId={event.id}
        recentFirst={isStacktraceNewestFirst()}
        fullStackTrace={stackView === StackView.FULL}
        title={hasMoreThanOneThread ? t('Thread Stack Trace') : t('Stack Trace')}
        platform={platform}
        isNestedSection={hasMoreThanOneThread}
        hasMinified={
          !!exception?.values?.find(value => value.rawStacktrace) ||
          !!activeThread?.rawStacktrace
        }
        hasVerboseFunctionNames={
          !!exception?.values?.some(
            value =>
              !!value.stacktrace?.frames?.some(
                frame =>
                  !!frame.rawFunction &&
                  !!frame.function &&
                  frame.rawFunction !== frame.function
              )
          ) ||
          !!activeThread?.stacktrace?.frames?.some(
            frame =>
              !!frame.rawFunction &&
              !!frame.function &&
              frame.rawFunction !== frame.function
          )
        }
        hasAbsoluteFilePaths={
          !!exception?.values?.some(
            value => !!value.stacktrace?.frames?.some(frame => !!frame.filename)
          ) || !!activeThread?.stacktrace?.frames?.some(frame => !!frame.filename)
        }
        hasAbsoluteAddresses={
          !!exception?.values?.some(
            value => !!value.stacktrace?.frames?.some(frame => !!frame.instructionAddr)
          ) || !!activeThread?.stacktrace?.frames?.some(frame => !!frame.instructionAddr)
        }
        hasAppOnlyFrames={
          !!exception?.values?.some(
            value => !!value.stacktrace?.frames?.some(frame => frame.inApp !== true)
          ) || !!activeThread?.stacktrace?.frames?.some(frame => frame.inApp !== true)
        }
        hasNewestFirst={
          !!exception?.values?.some(
            value => (value.stacktrace?.frames ?? []).length > 1
          ) || (activeThread?.stacktrace?.frames ?? []).length > 1
        }
        stackTraceNotFound={stackTraceNotFound}
      >
        {childrenProps => {
          return (
            <Fragment>
              {renderContent(childrenProps)}
              {hasStreamlinedUI && group && (
                <ErrorBoundary
                  mini
                  message={t('There was an error loading the suspect commits')}
                >
                  <SuspectCommits
                    projectSlug={projectSlug}
                    eventId={event.id}
                    commitRow={CommitRow}
                    group={group}
                  />
                </ErrorBoundary>
              )}
            </Fragment>
          );
        }}
      </TraceEventDataSection>
    </Fragment>
  );

  if (hasStreamlinedUI) {
    // If there is only one thread, we expect the stacktrace to wrap itself in a section
    return hasMoreThanOneThread ? (
      <InterimSection
        title={tn('Stack Trace', 'Stack Traces', threads.length)}
        type={SectionKey.STACKTRACE}
      >
        <Flex column gap={space(2)}>
          {threadComponent}
        </Flex>
      </InterimSection>
    ) : (
      threadComponent
    );
  }

  return hasMoreThanOneThread ? (
    <ThreadTraceWrapper>{threadComponent}</ThreadTraceWrapper>
  ) : (
    threadComponent
  );
}

const Grid = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${space(2)};
`;

const TheadStateContainer = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const ThreadStateWrapper = styled('div')`
  display: flex;
  position: relative;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.5)};
`;

const LockReason = styled(TextOverflow)`
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.gray300};
`;

const Wrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-wrap: wrap;
  flex-grow: 1;
  justify-content: flex-start;
`;

const ThreadTraceWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)} ${space(4)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(1)} ${space(2)};
  }
`;

const ThreadHeading = styled('h3')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;
