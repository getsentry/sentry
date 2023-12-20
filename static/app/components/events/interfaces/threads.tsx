import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {getLockReason} from 'sentry/components/events/interfaces/threads/threadSelector/lockReason';
import {
  getMappedThreadState,
  getThreadStateHelpText,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {IconClock, IconInfo, IconLock, IconPlay, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  EntryType,
  Event,
  Organization,
  Project,
  StackType,
  StackView,
  Thread,
} from 'sentry/types';
import {defined} from 'sentry/utils';

import {PermalinkTitle, TraceEventDataSection} from '../traceEventDataSection';

import {ExceptionContent} from './crashContent/exception';
import {StackTraceContent} from './crashContent/stackTrace';
import ThreadSelector from './threads/threadSelector';
import findBestThread from './threads/threadSelector/findBestThread';
import getThreadException from './threads/threadSelector/getThreadException';
import getThreadStacktrace from './threads/threadSelector/getThreadStacktrace';
import NoStackTraceMessage from './noStackTraceMessage';
import {inferPlatform, isStacktraceNewestFirst} from './utils';

type ExceptionProps = React.ComponentProps<typeof ExceptionContent>;

type Props = Pick<ExceptionProps, 'groupingCurrentLevel' | 'hasHierarchicalGrouping'> & {
  data: {
    values?: Array<Thread>;
  };
  event: Event;
  organization: Organization;
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

export function getThreadStateIcon(state: ThreadStates | undefined) {
  if (isNil(state)) {
    return null;
  }
  switch (state) {
    case ThreadStates.BLOCKED:
      return <IconLock isSolid />;
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

export function Threads({
  data,
  event,
  projectSlug,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  organization,
}: Props) {
  const threads = data.values ?? [];

  const [activeThread, setActiveThread] = useActiveThreadState(event, threads);

  const stackTraceNotFound = !threads.length;

  const hasMoreThanOneThread = threads.length > 1;

  const exception = getThreadException(event, activeThread);

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

    if (isNil(id) || !name) {
      return null;
    }

    const threadStateDisplay = getMappedThreadState(threadState);
    const lockReason = getLockReason(heldLocks);

    return (
      <Pills>
        {!isNil(id) && <Pill name={t('id')} value={String(id)} />}
        {!!name?.trim() && <Pill name={t('name')} value={name} />}
        {current !== undefined && <Pill name={t('was active')} value={current} />}
        {crashed !== undefined && (
          <Pill name={t('errored')} className={crashed ? 'false' : 'true'}>
            {crashed ? t('yes') : t('no')}
          </Pill>
        )}
        {!isNil(threadStateDisplay) && (
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
          hasHierarchicalGrouping={hasHierarchicalGrouping}
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
          hasHierarchicalGrouping={hasHierarchicalGrouping}
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
  const hideThreadTags = isNil(activeThreadId) || !activeThreadName;

  return (
    <Fragment>
      {hasMoreThanOneThread && organization.features.includes('anr-improvements') && (
        <Fragment>
          <Grid>
            <EventDataSection type={EntryType.THREADS} title={t('Threads')}>
              {activeThread && (
                <Wrapper>
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
            </EventDataSection>
            {activeThread && activeThread.state && (
              <EventDataSection type={EntryType.THREAD_STATE} title={t('Thread State')}>
                <ThreadStateWrapper>
                  {getThreadStateIcon(threadStateDisplay)}
                  <ThreadState>{threadStateDisplay}</ThreadState>
                  {threadStateDisplay && (
                    <QuestionTooltip
                      position="top"
                      size="xs"
                      containerDisplayMode="block"
                      title={getThreadStateHelpText(threadStateDisplay)}
                    />
                  )}
                  {<LockReason>{getLockReason(activeThread?.heldLocks)}</LockReason>}
                </ThreadStateWrapper>
              </EventDataSection>
            )}
          </Grid>
          {!hideThreadTags && (
            <EventDataSection type={EntryType.THREAD_TAGS} title={t('Thread Tags')}>
              {renderPills()}
            </EventDataSection>
          )}
        </Fragment>
      )}
      <TraceEventDataSection
        type={EntryType.THREADS}
        projectSlug={projectSlug}
        eventId={event.id}
        recentFirst={isStacktraceNewestFirst()}
        fullStackTrace={stackView === StackView.FULL}
        title={
          hasMoreThanOneThread &&
          activeThread &&
          !organization.features.includes('anr-improvements') ? (
            <ThreadSelector
              threads={threads}
              activeThread={activeThread}
              event={event}
              onChange={thread => {
                setActiveThread(thread);
              }}
              exception={exception}
              fullWidth
            />
          ) : (
            <PermalinkTitle>
              {hasMoreThanOneThread ? t('Thread Stack Trace') : t('Stack Trace')}
            </PermalinkTitle>
          )
        }
        platform={platform}
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
        wrapTitle={false}
      >
        {childrenProps => (
          <Fragment>
            {!organization.features.includes('anr-improvements') && renderPills()}
            {renderContent(childrenProps)}
          </Fragment>
        )}
      </TraceEventDataSection>
    </Fragment>
  );
}

const Grid = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
`;

const ThreadStateWrapper = styled('div')`
  display: flex;
  position: relative;
  flex-direction: row;
  align-items: flex-start;
  gap: ${space(0.5)};
`;

const ThreadState = styled(TextOverflow)`
  max-width: 100%;
  text-align: left;
  font-weight: bold;
`;

const LockReason = styled(TextOverflow)`
  font-weight: 400;
  color: ${p => p.theme.gray300};
`;

const Wrapper = styled('div')`
  align-items: center;
  flex-wrap: wrap;
  flex-grow: 1;
  justify-content: flex-start;
`;
