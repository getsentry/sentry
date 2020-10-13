import isNil from 'lodash/isNil';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import CrashContent from 'app/components/events/interfaces/crashContent';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import {defined} from 'app/utils';
import CrashTitle from 'app/components/events/interfaces/crashHeader/crashTitle';
import CrashActions from 'app/components/events/interfaces/crashHeader/crashActions';

import ThreadSelector from './threadSelector';
import getThreadStacktrace from './threadSelector/getThreadStacktrace';
import getThreadException from './threadSelector/getThreadException';

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

  renderMissingStacktrace = () => (
    <div className="traceback missing-traceback">
      <ul>
        <li className="frame missing-frame">
          <div className="title">
            <span className="informal">
              {this.props.data.crashed
                ? t('Thread Errored')
                : t('No or unknown stacktrace')}
            </span>
          </div>
        </li>
      </ul>
    </div>
  );

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
            <Pill name={t('id')} value={data.id} />
            <Pill name={t('name')} value={data.name} />
            <Pill name={t('was active')} value={data.current} />
            <Pill name={t('errored')} className={data.crashed ? 'false' : 'true'}>
              {data.crashed ? t('yes') : t('no')}
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

  getStacktrace = () =>
    getThreadStacktrace(
      this.state.activeThread,
      this.props.event,
      this.state.stackType !== 'original'
    );

  getException = () => getThreadException(this.state.activeThread, this.props.event);

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

  handleChange = newState => {
    this.setState(newState);
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

    const commonCrashHeaderProps = {
      newestFirst,
      hideGuide,
      onChange: this.handleChange,
    };

    const hasThreads = threads.length > 1;

    return (
      <EventDataSection
        event={evt}
        type={this.props.type}
        title={
          hasThreads ? (
            <CrashTitle
              title={null}
              beforeTitle={
                <ThreadSelector
                  threads={threads}
                  activeThread={activeThread}
                  event={this.props.event}
                  onChange={this.onSelectNewThread}
                />
              }
            />
          ) : (
            <CrashTitle title={t('Stacktrace')} />
          )
        }
        actions={
          <CrashActions
            stackView={stackView}
            platform={evt.platform}
            stacktrace={stacktrace}
            stackType={stackType}
            thread={hasThreads ? activeThread : undefined}
            exception={hasThreads ? exception : undefined}
            {...commonCrashHeaderProps}
          />
        }
        showPermalink={!hasThreads}
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
