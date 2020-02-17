import isNil from 'lodash/isNil';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import CrashHeader from 'app/components/events/interfaces/crashHeader';
import CrashContent from 'app/components/events/interfaces/crashContent';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import {defined} from 'app/utils';

import ThreadsSelector from './threadsSelector';
import getThreadStacktrace from './getThreadStacktrace';
import getThreadException from './getThreadException';

function getIntendedStackView(thread, event) {
  const stacktrace = getThreadStacktrace(thread, event, false);
  return stacktrace && stacktrace.hasSystemFrames ? 'app' : 'full';
}

function findBestThread(threads) {
  // Search the entire threads list for a crashed thread with stack
  // trace.
  return (
    threads.find(thread => thread.crashed) ||
    threads.find(thread => thread.stacktrace) ||
    threads[0]
  );
}

class Thread extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    stackView: PropTypes.string,
    stackType: PropTypes.string,
    newestFirst: PropTypes.bool,
    exception: PropTypes.object,
    stacktrace: PropTypes.object,
  };

  renderMissingStacktrace = () => {
    return (
      <div className="traceback missing-traceback">
        <ul>
          <li className="frame missing-frame">
            <div className="title">
              <span className="informal">
                {this.props.data.crashed ? 'Thread Crashed' : 'No or unknown stacktrace'}
              </span>
            </div>
          </li>
        </ul>
      </div>
    );
  };

  hasMissingStacktrace = () => {
    const {exception, stacktrace} = this.props;
    return !(exception || stacktrace);
  };

  render() {
    const {
      data,
      event,
      projectId,
      stackView,
      stackType,
      newestFirst,
      exception,
      stacktrace,
    } = this.props;

    const renderPills = !isNil(data.id) || !!data.name;

    return (
      <div className="thread">
        {renderPills && (
          <Pills>
            <Pill name="id" value={data.id} />
            <Pill name="name" value={data.name} />
            <Pill name="was active" value={data.current} />
            <Pill name="crashed" className={data.crashed ? 'false' : 'true'}>
              {data.crashed ? 'yes' : 'no'}
            </Pill>
          </Pills>
        )}

        {this.hasMissingStacktrace() ? (
          this.renderMissingStacktrace()
        ) : (
          <CrashContent
            event={event}
            stackType={stackType}
            stackView={stackView}
            newestFirst={newestFirst}
            projectId={projectId}
            exception={exception}
            stacktrace={stacktrace}
          />
        )}
      </div>
    );
  }
}

class ThreadsInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    projectId: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    hideGuide: PropTypes.bool,
  };

  static defaultProps = {
    hideGuide: false,
  };

  constructor(props) {
    super(props);
    const thread = defined(props.data.values)
      ? findBestThread(props.data.values)
      : undefined;

    this.state = {
      activeThread: thread,
      stackView: thread ? getIntendedStackView(thread, props.event) : undefined,
      stackType: 'original',
      newestFirst: isStacktraceNewestFirst(),
    };
  }

  toggleStack = value => {
    this.setState({
      stackView: value,
    });
  };

  getStacktrace = () => {
    return getThreadStacktrace(
      this.state.activeThread,
      this.props.event,
      this.state.stackType !== 'original'
    );
  };

  getException = () => {
    return getThreadException(this.state.activeThread, this.props.event);
  };

  onSelectNewThread = thread => {
    let newStackView = this.state.stackView;
    if (this.state.stackView !== 'raw') {
      newStackView = getIntendedStackView(thread, this.props.event);
    }
    this.setState({
      activeThread: thread,
      stackView: newStackView,
      stackType: 'original',
    });
  };

  render() {
    const threads = this.props.data.values || [];

    if (threads.length === 0) {
      return null;
    }

    const evt = this.props.event;
    const {projectId, hideGuide} = this.props;
    const {stackView, stackType, newestFirst, activeThread} = this.state;
    const exception = this.getException();
    const stacktrace = this.getStacktrace();

    const titleProps = {
      platform: evt.platform,
      stacktrace,
      stackView,
      newestFirst,
      hideGuide,
      stackType,
      onChange: newState => this.setState(newState),
    };

    const title =
      threads.length > 1 ? (
        <CrashHeader
          title={null}
          beforeTitle={
            <ThreadsSelector
              threads={threads}
              activeThread={activeThread}
              event={this.props.event}
              onChange={this.onSelectNewThread}
            />
          }
          thread={activeThread}
          exception={exception}
          {...titleProps}
        />
      ) : (
        <CrashHeader title={t('Stacktrace')} {...titleProps} />
      );

    return (
      <EventDataSection
        event={evt}
        type={this.props.type}
        title={title}
        wrapTitle={false}
      >
        <Thread
          data={activeThread}
          exception={exception}
          stackView={stackView}
          stackType={stackType}
          stacktrace={stacktrace}
          event={evt}
          newestFirst={newestFirst}
          projectId={projectId}
        />
      </EventDataSection>
    );
  }
}

export default ThreadsInterface;
