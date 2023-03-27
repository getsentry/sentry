import {useState} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import CrashActions from 'sentry/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'sentry/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'sentry/locale';
import {EntryType, Event, Project, STACK_TYPE, STACK_VIEW, Thread} from 'sentry/types';
import {defined} from 'sentry/utils';

import {PermalinkTitle} from '../../traceEventDataSection';
import {isStacktraceNewestFirst} from '../utils';

import findBestThread from './threadSelector/findBestThread';
import getThreadException from './threadSelector/getThreadException';
import getThreadStacktrace from './threadSelector/getThreadStacktrace';
import Content from './content';
import ThreadSelector from './threadSelector';

type Props = Pick<
  React.ComponentProps<typeof Content>,
  'groupingCurrentLevel' | 'hasHierarchicalGrouping'
> & {
  data: {
    values?: Array<Thread>;
  };
  event: Event;
  projectSlug: Project['slug'];
  hideGuide?: boolean;
};

type State = {
  newestFirst: boolean;
  stackType: STACK_TYPE;
  activeThread?: Thread;
  stackView?: STACK_VIEW;
};

function getIntendedStackView(thread: Thread, event: Event) {
  const exception = getThreadException(event, thread);
  if (exception) {
    return exception.values.find(value => !!value.stacktrace?.hasSystemFrames)
      ? STACK_VIEW.APP
      : STACK_VIEW.FULL;
  }

  const stacktrace = getThreadStacktrace(false, thread);

  return stacktrace?.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL;
}

export function Threads({
  data,
  event,
  projectSlug,
  hasHierarchicalGrouping,
  groupingCurrentLevel,
  hideGuide = false,
}: Props) {
  const [state, setState] = useState<State>(() => {
    const thread = defined(data.values) ? findBestThread(data.values) : undefined;
    return {
      activeThread: thread,
      stackView: thread ? getIntendedStackView(thread, event) : undefined,
      stackType: STACK_TYPE.ORIGINAL,
      newestFirst: isStacktraceNewestFirst(),
    };
  });

  if (!data.values) {
    return null;
  }

  function handleSelectNewThread(thread: Thread) {
    setState({
      ...state,
      activeThread: thread,
      stackView:
        state.stackView !== STACK_VIEW.RAW
          ? getIntendedStackView(thread, event)
          : state.stackView,
      stackType: STACK_TYPE.ORIGINAL,
    });
  }

  function handleChangeNewestFirst({newestFirst}: Pick<State, 'newestFirst'>) {
    setState({...state, newestFirst});
  }

  function handleChangeStackView({
    stackView,
    stackType,
  }: Partial<Pick<State, 'stackType' | 'stackView'>>) {
    setState({
      ...state,
      stackView: stackView ?? state.stackView,
      stackType: stackType ?? state.stackType,
    });
  }

  const threads = data.values;
  const {stackView, stackType, newestFirst, activeThread} = state;

  const exception = getThreadException(event, activeThread);

  const stacktrace = !exception
    ? getThreadStacktrace(stackType !== STACK_TYPE.ORIGINAL, activeThread)
    : undefined;

  const stackTraceNotFound = !(exception || stacktrace);
  const hasMoreThanOneThread = threads.length > 1;

  return (
    <EventDataSection
      type={EntryType.THREADS}
      title={
        hasMoreThanOneThread ? (
          <CrashTitle
            title=""
            newestFirst={newestFirst}
            hideGuide={hideGuide}
            onChange={handleChangeNewestFirst}
            beforeTitle={
              activeThread && (
                <ThreadSelector
                  threads={threads}
                  activeThread={activeThread}
                  event={event}
                  onChange={handleSelectNewThread}
                  exception={exception}
                />
              )
            }
          />
        ) : (
          <PermalinkTitle>
            <CrashTitle
              title={t('Stack Trace')}
              newestFirst={newestFirst}
              hideGuide={hideGuide}
              onChange={!stackTraceNotFound ? handleChangeNewestFirst : undefined}
            />
          </PermalinkTitle>
        )
      }
      actions={
        !stackTraceNotFound && (
          <CrashActions
            stackView={stackView}
            platform={event.platform}
            stacktrace={stacktrace}
            stackType={stackType}
            thread={hasMoreThanOneThread ? activeThread : undefined}
            exception={exception}
            onChange={handleChangeStackView}
            hasHierarchicalGrouping={hasHierarchicalGrouping}
          />
        )
      }
      wrapTitle={false}
    >
      <Content
        data={activeThread}
        exception={exception}
        stackView={stackView}
        stackType={stackType}
        stacktrace={stacktrace}
        event={event}
        newestFirst={newestFirst}
        projectSlug={projectSlug}
        groupingCurrentLevel={groupingCurrentLevel}
        stackTraceNotFound={stackTraceNotFound}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
      />
    </EventDataSection>
  );
}
