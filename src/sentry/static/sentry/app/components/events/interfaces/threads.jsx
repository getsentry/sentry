import isNil from 'lodash/isNil';
import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {isStacktraceNewestFirst} from 'app/components/events/interfaces/stacktrace';
import {defined} from 'app/utils';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import {trimPackage} from 'app/components/events/interfaces/frame';
import CrashHeader from 'app/components/events/interfaces/crashHeader';
import CrashContent from 'app/components/events/interfaces/crashContent';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';

function trimFilename(fn) {
  const pieces = fn.split(/\//g);
  return pieces[pieces.length - 1];
}

function findRelevantFrame(stacktrace) {
  if (!stacktrace.hasSystemFrames) {
    return stacktrace.frames[stacktrace.frames.length - 1];
  }
  for (let i = stacktrace.frames.length - 1; i >= 0; i--) {
    const frame = stacktrace.frames[i];
    if (frame.inApp) {
      return frame;
    }
  }
  // this should not happen
  return stacktrace.frames[stacktrace.frames.length - 1];
}

function findThreadException(thread, event) {
  for (const entry of event.entries) {
    if (entry.type !== 'exception') {
      continue;
    }
    for (const exc of entry.data.values) {
      if (exc.threadId === thread.id) {
        return entry.data;
      }
    }
  }
  return null;
}

function findThreadStacktrace(thread, event, raw) {
  if (raw && thread.rawStacktrace) {
    return thread.rawStacktrace;
  } else if (thread.stacktrace) {
    return thread.stacktrace;
  }
  const exc = findThreadException(thread, event);
  if (exc) {
    let rv = null;
    for (const singleExc of exc.values) {
      if (singleExc.threadId === thread.id) {
        rv = (raw && singleExc.rawStacktrace) || singleExc.stacktrace;
      }
    }
    return rv;
  }
  return null;
}

function getThreadTitle(thread, event, simplified) {
  const stacktrace = findThreadStacktrace(thread, event, false);
  const bits = ['Thread'];
  if (defined(thread.name)) {
    bits.push(` "${thread.name}"`);
  }
  if (defined(thread.id)) {
    bits.push(' #' + thread.id);
  }

  if (!simplified) {
    if (stacktrace) {
      const frame = findRelevantFrame(stacktrace);
      bits.push(' — ');
      bits.push(
        <em key="location">
          {frame.filename
            ? trimFilename(frame.filename)
            : frame.package
            ? trimPackage(frame.package)
            : frame.module
            ? frame.module
            : '<unknown>'}
        </em>
      );
    }

    if (thread.crashed) {
      const exc = findThreadException(thread, event);
      bits.push(' — ');
      bits.push(
        <small key="crashed">
          {exc ? `(crashed with ${exc.values[0].type})` : '(crashed)'}
        </small>
      );
    }
  }

  return bits;
}

function getIntendedStackView(thread, event) {
  const stacktrace = findThreadStacktrace(thread, event, false);
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
    const thread = findBestThread(props.data.values);

    this.state = {
      activeThread: thread,
      stackView: getIntendedStackView(thread, props.event),
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
    return findThreadStacktrace(
      this.state.activeThread,
      this.props.event,
      this.state.stackType !== 'original'
    );
  };

  getException = () => {
    return findThreadException(this.state.activeThread, this.props.event);
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
    const evt = this.props.event;
    const {projectId, hideGuide} = this.props;
    const {stackView, stackType, newestFirst, activeThread} = this.state;
    const exception = this.getException();
    const stacktrace = this.getStacktrace();

    const threads = this.props.data.values || [];

    const threadSelector = (
      <div className="pull-left btn-group">
        <DropdownLink
          btnGroup
          caret
          className="btn btn-default btn-sm"
          title={getThreadTitle(activeThread, this.props.event, true)}
        >
          {threads.map((thread, idx) => {
            return (
              <MenuItem key={idx} noAnchor>
                <a onClick={this.onSelectNewThread.bind(this, thread)}>
                  {getThreadTitle(thread, this.props.event, false)}
                </a>
              </MenuItem>
            );
          })}
        </DropdownLink>
      </div>
    );

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
          beforeTitle={threadSelector}
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
