import React from 'react';

import {t} from 'app/locale';
import {Event, Project} from 'app/types';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import {defined} from 'app/utils';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import EventDataSection from 'app/components/events/eventDataSection';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';
import {Thread} from 'app/types/events';

import ThreadSelector from './threadSelector';
import Content from './content';
import getThreadStacktrace from './threadSelector/getThreadStacktrace';
import getThreadException from './threadSelector/getThreadException';

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

class ThreadInterface extends React.Component<Props, State> {
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

  handleChangeStackView = ({stackView, stackType}) => {
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
    const hasThreads = threads.length > 1;

    return (
      <EventDataSection
        type={type}
        title={
          hasThreads ? (
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
              title={t('Stacktrace')}
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
            thread={hasThreads ? activeThread : undefined}
            exception={hasThreads ? exception : undefined}
            onChange={this.handleChangeStackView}
          />
        }
        showPermalink={!hasThreads}
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

export default ThreadInterface;
