import {useState} from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import {t} from 'app/locale';
import {Project} from 'app/types';
import {Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';

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
  event: Event;
  projectId: Project['id'];
  type: string;
  data: {
    values?: Array<Thread>;
  };
  hideGuide?: boolean;
};

type State = {
  stackType: STACK_TYPE;
  newestFirst: boolean;
  activeThread?: Thread;
  stackView?: STACK_VIEW;
};

function getIntendedStackView(thread: Thread, event: Event) {
  const exception = getThreadException(event, thread);
  if (exception) {
    return !!exception.values.find(value => !!value.stacktrace?.hasSystemFrames)
      ? STACK_VIEW.APP
      : STACK_VIEW.FULL;
  }

  const stacktrace = getThreadStacktrace(false, thread);

  return stacktrace?.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL;
}

function Threads({
  data,
  event,
  projectId,
  type,
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
      type={type}
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
          <CrashTitle
            title={t('Stack Trace')}
            newestFirst={newestFirst}
            hideGuide={hideGuide}
            onChange={!stackTraceNotFound ? handleChangeNewestFirst : undefined}
          />
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
      showPermalink={!hasMoreThanOneThread}
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
        projectId={projectId}
        groupingCurrentLevel={groupingCurrentLevel}
        stackTraceNotFound={stackTraceNotFound}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
      />
    </EventDataSection>
  );
}

export default Threads;
