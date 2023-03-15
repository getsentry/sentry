import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  EntryType,
  Event,
  Frame,
  PlatformType,
  Project,
  STACK_TYPE,
  STACK_VIEW,
  Thread,
} from 'sentry/types';

import {PermalinkTitle, TraceEventDataSection} from '../traceEventDataSection';

import Exception from './crashContent/exception';
import StackTrace from './crashContent/stackTrace';
import ThreadSelector from './threads/threadSelector';
import findBestThread from './threads/threadSelector/findBestThread';
import getThreadException from './threads/threadSelector/getThreadException';
import getThreadStacktrace from './threads/threadSelector/getThreadStacktrace';
import NoStackTraceMessage from './noStackTraceMessage';
import {isStacktraceNewestFirst} from './utils';

type ExceptionProps = React.ComponentProps<typeof Exception>;

type Props = Pick<ExceptionProps, 'groupingCurrentLevel' | 'hasHierarchicalGrouping'> & {
  data: {
    values?: Array<Thread>;
  };
  event: Event;
  projectSlug: Project['slug'];
};

type State = {
  activeThread?: Thread;
};

function getIntendedStackView(
  thread: Thread,
  exception: ReturnType<typeof getThreadException>
): STACK_VIEW {
  if (exception) {
    return exception.values.find(value => !!value.stacktrace?.hasSystemFrames)
      ? STACK_VIEW.APP
      : STACK_VIEW.FULL;
  }

  const stacktrace = getThreadStacktrace(false, thread);

  return stacktrace?.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL;
}

export function ThreadsV2({
  data,
  event,
  projectSlug,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
}: Props) {
  const threads = data.values ?? [];

  const [state, setState] = useState<State>(() => {
    const thread = threads.length ? findBestThread(threads) : undefined;
    return {activeThread: thread};
  });

  const stackTraceNotFound = !threads.length;
  const {activeThread} = state;

  const hasMoreThanOneThread = threads.length > 1;

  const exception = getThreadException(event, activeThread);

  const entryIndex = exception
    ? event.entries.findIndex(entry => entry.type === EntryType.EXCEPTION)
    : event.entries.findIndex(entry => entry.type === EntryType.THREADS);

  const meta = event._meta?.entries?.[entryIndex]?.data?.values;

  const stackView = activeThread
    ? getIntendedStackView(activeThread, exception)
    : undefined;

  function getPlatform(): PlatformType {
    let exceptionFramePlatform: Frame | undefined = undefined;

    for (const value of exception?.values ?? []) {
      exceptionFramePlatform = value.stacktrace?.frames?.find(frame => !!frame.platform);
      if (exceptionFramePlatform) {
        break;
      }
    }

    if (exceptionFramePlatform?.platform) {
      return exceptionFramePlatform.platform;
    }

    const threadFramePlatform = activeThread?.stacktrace?.frames?.find(
      frame => !!frame.platform
    );

    if (threadFramePlatform?.platform) {
      return threadFramePlatform.platform;
    }

    return event.platform ?? 'other';
  }

  function renderPills() {
    const {
      id,
      name,
      current,
      crashed,
      state: threadState,
      lockReason,
    } = activeThread ?? {};

    if (isNil(id) || !name) {
      return null;
    }

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
        {!isNil(threadState) && <Pill name={t('state')} value={threadState} />}
        {!isNil(lockReason) && <Pill name={t('lock reason')} value={lockReason} />}
      </Pills>
    );
  }

  function renderContent({
    display,
    recentFirst,
    fullStackTrace,
  }: Parameters<React.ComponentProps<typeof TraceEventDataSection>['children']>[0]) {
    const stackType = display.includes('minified')
      ? STACK_TYPE.MINIFIED
      : STACK_TYPE.ORIGINAL;

    if (exception) {
      return (
        <Exception
          stackType={stackType}
          stackView={
            display.includes('raw-stack-trace')
              ? STACK_VIEW.RAW
              : fullStackTrace
              ? STACK_VIEW.FULL
              : STACK_VIEW.APP
          }
          projectSlug={projectSlug}
          newestFirst={recentFirst}
          event={event}
          platform={platform}
          values={exception.values}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          meta={meta}
        />
      );
    }

    const stackTrace = getThreadStacktrace(
      stackType !== STACK_TYPE.ORIGINAL,
      activeThread
    );

    if (stackTrace) {
      return (
        <StackTrace
          stacktrace={stackTrace}
          stackView={
            display.includes('raw-stack-trace')
              ? STACK_VIEW.RAW
              : fullStackTrace
              ? STACK_VIEW.FULL
              : STACK_VIEW.APP
          }
          newestFirst={recentFirst}
          event={event}
          platform={platform}
          groupingCurrentLevel={groupingCurrentLevel}
          hasHierarchicalGrouping={hasHierarchicalGrouping}
          meta={meta}
          nativeV2
        />
      );
    }

    return (
      <NoStackTraceMessage
        message={activeThread?.crashed ? t('Thread Errored') : undefined}
      />
    );
  }

  const platform = getPlatform();

  return (
    <Fragment>
      {hasMoreThanOneThread && (
        <EventDataSection type={EntryType.THREADS} title={t('Threads')}>
          {activeThread && (
            <Wrapper>
              <ThreadSelector
                threads={threads}
                activeThread={activeThread}
                event={event}
                onChange={thread => {
                  setState({
                    ...state,
                    activeThread: thread,
                  });
                }}
                exception={exception}
              />
            </Wrapper>
          )}
          {renderPills()}
        </EventDataSection>
      )}
      <TraceEventDataSection
        type={EntryType.THREADS}
        stackType={STACK_TYPE.ORIGINAL}
        projectSlug={projectSlug}
        eventId={event.id}
        recentFirst={isStacktraceNewestFirst()}
        fullStackTrace={stackView === STACK_VIEW.FULL}
        title={
          <PermalinkTitle>
            {hasMoreThanOneThread ? t('Thread Stack Trace') : t('Stack Trace')}
          </PermalinkTitle>
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
        {childrenProps => <Fragment>{renderContent(childrenProps)}</Fragment>}
      </TraceEventDataSection>
    </Fragment>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  flex-grow: 1;
  justify-content: flex-start;
  padding-bottom: ${space(2)};
`;
