import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import rawStacktraceContent from './rawStacktraceContent';
import StacktraceContent from './stacktraceContent';
import {getStacktraceDefaultState} from './stacktrace';
import {t} from '../../../locale';
import {defined} from '../../../utils';


const Thread = React.createClass({
  propTypes: {
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
    stackView: React.PropTypes.string.isRequired,
    newestFirst: React.PropTypes.bool.isRequired,
  },

  renderTitle() {
    const {data} = this.props;
    let bits = ['Thread'];
    if (defined(data.name)) {
      bits.push(`"${data.name}"`);
    }
    if (defined(data.id)) {
      bits.push('#' + data.id);
    }
    return <h4>{bits.join(' ')}</h4>;
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
        {this.renderTitle()}
        {this.props.data.stacktrace ? (
          this.props.stackView === 'raw' ?
            <pre className="traceback plain">
              {rawStacktraceContent(this.props.data.stacktrace, this.props.platform)}
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
    let hasSystemFrames = false;
    for (let thread in this.props.data.list) {
      if (thread.hasSystemFrames) {
        hasSystemFrames = true;
        break;
      }
    }
    let rv = getStacktraceDefaultState(null, hasSystemFrames);
    rv.hasSystemFrames = hasSystemFrames;
    return rv;
  },

  toggleStack(value) {
    this.setState({
      stackView: value
    });
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let {stackView, newestFirst, hasSystemFrames} = this.state;

    let title = (
      <div>
        <div className="btn-group">
          {hasSystemFrames &&
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
        {this.props.data.list.map((thread, idx) => {
          return (
            <Thread
              key={idx}
              data={thread}
              event={evt}
              stackView={stackView}
              newestFirst={newestFirst} />
          );
        })}
      </GroupEventDataSection>
    );
  }
});

export default ThreadsInterface;
