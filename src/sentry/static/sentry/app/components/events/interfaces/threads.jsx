import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import rawStacktraceContent from './rawStacktraceContent';
import StacktraceContent from './stacktraceContent';
import {isStacktraceNewestFirst} from './stacktrace';
import {t} from '../../../locale';
import {defined} from '../../../utils';
import DropdownLink from '../../dropdownLink';
import MenuItem from '../../menuItem';
import {trimPackage} from './frame';


function trimFilename(fn) {
  let pieces = fn.split(/\//g);
  return pieces[pieces.length - 1];
}

function findRelevantFrame(stacktrace) {
  if (!stacktrace.hasSystemFrames) {
    return stacktrace.frames[stacktrace.frames.length - 1];
  }
  for (let i = stacktrace.frames.length - 1; i >= 0; i--) {
    let frame = stacktrace.frames[i];
    if (frame.inApp) {
      return frame;
    }
  }
  // this should not happen
  return stacktrace.frames[stacktrace.frames.length - 1];
}

function findThreadStacktrace(thread, event) {
  if (thread.stacktrace) {
    return thread.stacktrace;
  }
  let stack = null;
  for (let entry of event.entries) {
    if (entry.type === 'stacktrace') {
      stack = entry.data;
    } else if (entry.type === 'exception') {
      for (let exc of entry.data.values) {
        if (exc.threadId === thread.id && exc.stacktrace) {
          stack = exc.stacktrace;
          break;
        }
      }
    }
  }
  return stack;
}

function getThreadTitle(thread, event) {
  let stacktrace = findThreadStacktrace(thread, event);
  let bits = ['Thread'];
  if (defined(thread.name)) {
    bits.push(` "${thread.name}"`);
  }
  if (defined(thread.id)) {
    bits.push(' #' + thread.id);
  }

  if (stacktrace) {
    let frame = findRelevantFrame(stacktrace);
    bits.push(' — ');
    bits.push(
      <em key="location">{frame.filename
        ? trimFilename(frame.filename)
        : frame.package
          ? trimPackage(frame.package)
          : frame.module ? frame.module : '<unknown>'}</em>
    );
  }

  return bits;
}

function getIntendedStackView(thread, event) {
  const stacktrace = findThreadStacktrace(thread, event);
  return (stacktrace && stacktrace.hasSystemFrames) ? 'app' : 'full';
}

function findBestThread(threads) {
  for (let thread of threads) {
    if (thread.crashed) {
      return thread;
    }
  }
  for (let thread of threads) {
    if (thread.stacktrace) {
      return thread;
    }
  }
  return threads[0];
}


const Thread = React.createClass({
  propTypes: {
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
    stackView: React.PropTypes.string,
    newestFirst: React.PropTypes.bool,
    stacktrace: React.PropTypes.object,
  },

  renderMissingStacktrace() {
    return (
      <div className="traceback missing-traceback">
        <ul>
          <li className="frame missing-frame">
            <div className="title">
              <span className="informal">
                {this.props.data.crashed
                  ? 'Thread Crashed'
                  : 'No or unknown stacktrace'}
              </span>
            </div>
          </li>
        </ul>
      </div>
    );
  },

  render() {
    return (
      <div className="thread">
        <h4>{getThreadTitle(this.props.data, this.props.event)}</h4>
        {this.props.stacktrace ? (
          this.props.stackView === 'raw' ?
            <pre className="traceback plain">
              {rawStacktraceContent(
                this.props.stacktrace, this.props.platform)}
            </pre>
          :
            <StacktraceContent
                data={this.props.stacktrace}
                includeSystemFrames={this.props.stackView === 'full'}
                platform={this.props.event.platform}
                newestFirst={this.props.newestFirst} />
        ) : (
          this.renderMissingStacktrace()
        )}
      </div>
    );
  }
});

const ThreadsInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string
  },

  getInitialState() {
    let thread = findBestThread(this.props.data.values);
    return {
      activeThread: thread,
      stackView: getIntendedStackView(thread, this.props.event),
      newestFirst: isStacktraceNewestFirst(),
    };
  },

  toggleStack(value) {
    this.setState({
      stackView: value
    });
  },

  getStacktrace() {
    return findThreadStacktrace(this.state.activeThread, this.props.event);
  },

  onSelectNewThread(thread) {
    let newStackView = this.state.stackView;
    if (this.state.stackView !== 'raw') {
      newStackView = getIntendedStackView(thread, this.props.event);
    }
    this.setState({
      activeThread: thread,
      stackView: newStackView,
    });
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let {stackView, newestFirst, activeThread} = this.state;
    let stacktrace = this.getStacktrace();

    let title = (
      <div>
        <div className="pull-right btn-group">
          <DropdownLink 
            btnGroup={true}
            caret={true}
            className="btn btn-default btn-sm"
            title={getThreadTitle(activeThread, this.props.event)}>
            {this.props.data.values.map((thread, idx) => {
              return (
                <MenuItem key={idx} noAnchor={true}>
                  <a onClick={this.onSelectNewThread.bind(this, thread)
                    }>{getThreadTitle(thread, this.props.event)}</a>
                </MenuItem>
              );
            })}
          </DropdownLink>
        </div>
        <div className="btn-group">
          {(stacktrace && stacktrace.hasSystemFrames) &&
            <a className={(stackView === 'app' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleStack.bind(this, 'app')}>{t('App Only')}</a>
          }
          <a className={(stackView === 'full' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleStack.bind(this, 'full')}>{t('Full')}</a>
          <a className={(stackView === 'raw' ? 'active' : '') + ' btn btn-default btn-sm'} onClick={this.toggleStack.bind(this, 'raw')}>{t('Raw')}</a>
        </div>
        <h3>
          {'Threads '}
          {newestFirst ?
            <small>({t('most recent call last')})</small>
          :
            <small>({t('most recent call first')})</small>
          }
        </h3>
      </div>
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        <Thread
          data={activeThread}
          stackView={stackView}
          stacktrace={stacktrace}
          event={evt}
          newestFirst={newestFirst} />
      </GroupEventDataSection>
    );
  }
});

export default ThreadsInterface;
