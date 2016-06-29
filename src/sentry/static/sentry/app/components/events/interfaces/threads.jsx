import React from 'react';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import rawStacktraceContent from './rawStacktraceContent';
import StacktraceContent from './stacktraceContent';
import {getStacktraceDefaultState} from './stacktrace';
import {t} from '../../../locale';


const Thread = React.createClass({
  propTypes: {
    event: PropTypes.Event.isRequired,
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string,
    stackView: React.PropTypes.string.isRequired,
    newestFirst: React.PropTypes.bool.isRequired,
  },

  renderTitle() {
    let bits = [];
    if (this.data.index) {
      bits.push('#' + this.data.index);
    }
    if (this.data.name) {
      bits.push(`"${this.data.name}"`);
    }
    if (this.data.id) {
      bits.push('id=' + this.data.id);
    }
    return <h3>bits.join(' ')</h3>;
  },

  render() {
    return (
      <div className="thread">
        {this.renderTitle()}
        {this.props.data.stacktrace && (
          this.props.stackView === 'raw' ?
            <pre className="traceback plain">
              {rawStacktraceContent(this.props.data.stacktrace, this.props.platform)}
            </pre>
          :
            <StacktraceContent
                data={this.props.data.stacktrace}
                className="no-exception"
                includeSystemFrames={this.props.stackView === 'full'}
                platform={this.props.event.platform}
                newestFirst={this.props.newestFirst} />
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
    for (let thread in this.props.data.threads) {
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
          {'Threads'}
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
        {this.state.threads.map((thread, idx) => {
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
