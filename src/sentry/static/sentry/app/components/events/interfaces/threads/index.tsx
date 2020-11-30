import React from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import {t} from 'app/locale';
import {Event, Project} from 'app/types';
import {Thread} from 'app/types/events';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';

import getThreadException from './threadSelector/getThreadException';
import getThreadStacktrace from './threadSelector/getThreadStacktrace';
import Content from './content';
import ThreadSelector from './threadSelector';

const defaultProps = {
  hideGuide: false,
};

type Props = {
  event: Event;
  projectId: Project['id'];
  type: string;
  data: {
    values?: Array<Thread>;
  };
} & typeof defaultProps;

type State = {
  activeThread: Thread;
  stackView: STACK_VIEW;
  stackType: STACK_TYPE;
  newestFirst: boolean;
};

function getIntendedStackView(thread: Thread, event: Event) {
  const stacktrace = getThreadStacktrace(thread, event, false);
  return stacktrace && stacktrace.hasSystemFrames ? STACK_VIEW.APP : STACK_VIEW.FULL;
}

function findBestThread(threads: Array<Thread>) {
  // Search the entire threads list for a crashed thread with stack
  // trace.
  return (
    threads.find(thread => thread.crashed) ||
    threads.find(thread => thread.stacktrace) ||
    threads[0]
  );
}

class Threads extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = this.getInitialState();

  getInitialState() {
    const {data, event} = this.props;
    const thread = defined(data.values) ? findBestThread(data.values) : undefined;
    return {
      activeThread: thread,
      stackView: thread ? getIntendedStackView(thread, event) : undefined,
      stackType: STACK_TYPE.ORIGINAL,
      newestFirst: isStacktraceNewestFirst(),
    } as State;
  }

  handleSelectNewThread = (thread: Thread) => {
    this.setState(prevState => ({
      activeThread: thread,
      stackView:
        prevState.stackView !== STACK_VIEW.RAW
          ? getIntendedStackView(thread, this.props.event)
          : prevState.stackView,
      stackType: STACK_TYPE.ORIGINAL,
    }));
  };

  handleChangeNewestFirst = ({newestFirst}: Pick<State, 'newestFirst'>) => {
    this.setState({newestFirst});
  };

  handleChangeStackView = ({
    stackView,
    stackType,
  }: Partial<Pick<State, 'stackType' | 'stackView'>>) => {
    this.setState(prevState => ({
      stackView: stackView ?? prevState.stackView,
      stackType: stackType ?? prevState.stackType,
    }));
  };

  render() {
    const {data, event, projectId, hideGuide, type} = this.props;

    if (!data.values) {
      return null;
    }

    const threads = data.values;
    const {stackView, stackType, newestFirst, activeThread} = this.state;

    const exception = getThreadException(activeThread, event);
    const stacktrace = getThreadStacktrace(
      activeThread,
      event,
      stackType !== STACK_TYPE.ORIGINAL
    );

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
              onChange={this.handleChangeNewestFirst}
              beforeTitle={
                <ThreadSelector
                  threads={threads}
                  activeThread={activeThread}
                  event={event}
                  onChange={this.handleSelectNewThread}
                />
              }
            />
          ) : (
            <CrashTitle
              title={t('Stack Trace')}
              newestFirst={newestFirst}
              hideGuide={hideGuide}
              onChange={this.handleChangeNewestFirst}
            />
          )
        }
        actions={
          <CrashActions
            stackView={stackView}
            platform={event.platform}
            stacktrace={stacktrace}
            stackType={stackType}
            thread={hasMoreThanOneThread ? activeThread : undefined}
            exception={hasMoreThanOneThread ? exception : undefined}
            onChange={this.handleChangeStackView}
          />
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
        />
      </EventDataSection>
    );
  }
}

export default Threads;
