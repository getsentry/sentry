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


function getThreadTitle(data) {
  let bits = ['Thread'];
  if (defined(data.name)) {
    bits.push(` "${data.name}"`);
  }
  if (defined(data.id)) {
    bits.push(' #' + data.id);
  }
  // TODO: show last stack frame here
  return bits.join('');
}

function getIntendedStackView(thread) {
  const {stacktrace} = thread;
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
      return thread.stacktrace;
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
        <h4>{getThreadTitle(this.props.data)}</h4>
        {this.props.data.stacktrace ? (
          this.props.stackView === 'raw' ?
            <pre className="traceback plain">
              {rawStacktraceContent(
                this.props.data.stacktrace, this.props.platform)}
            </pre>
          :
            <StacktraceContent
                data={this.props.data.stacktrace}
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
      stackView: getIntendedStackView(thread),
      newestFirst: isStacktraceNewestFirst(),
    };
  },

  toggleStack(value) {
    this.setState({
      stackView: value
    });
  },

  onSelectNewThread(thread) {
    let newStackView = this.state.stackView;
    if (this.state.stackView !== 'raw') {
      newStackView = getIntendedStackView(thread);
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
    let {stacktrace} = activeThread;

    let title = (
      <div>
        <div className="pull-right btn-group">
          <DropdownLink 
            btnGroup={true}
            caret={true}
            className="btn btn-default btn-sm"
            title={getThreadTitle(activeThread)}>
            {this.props.data.values.map((thread, idx) => {
              return (
                <MenuItem key={idx} noAnchor={true}>
                  <a onClick={this.onSelectNewThread.bind(this, thread)
                    }>{getThreadTitle(thread)}</a>
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
          event={evt}
          newestFirst={newestFirst} />
      </GroupEventDataSection>
    );
  }
});

export default ThreadsInterface;
