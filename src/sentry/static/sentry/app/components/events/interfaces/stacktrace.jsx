import React from 'react';
import ConfigStore from '../../../stores/configStore';
import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import {t} from '../../../locale';
import CrashHeader from './crashHeader';
import CrashContent from './crashContent';


export function isStacktraceNewestFirst() {
  let user = ConfigStore.get('user');
  // user may not be authenticated
  let options = user ? user.options : {};
  switch (options.stacktraceOrder) {
    case 'newestFirst':
      return true;
    case 'newestLast':
      return false;
    case 'default': // is "default" a valid value? or bad case statement
    default:
      return true;
  }
}


const StacktraceInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    platform: React.PropTypes.string
  },

  getInitialState() {
    return {
      stackView: this.props.data.hasSystemFrames ? 'app' : 'full',
      newestFirst: isStacktraceNewestFirst(),
    };
  },

  toggleStack(value) {
    this.setState({
      stackView: value
    });
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;
    let data = this.props.data;
    let stackView = this.state.stackView;
    let newestFirst = this.state.newestFirst;

    let title = (
      <CrashHeader
        title={t('Stacktrace')}
        group={group}
        platform={evt.platform}
        stacktrace={data}
        stackView={stackView}
        newestFirst={newestFirst}
        onChange={(newState) => {
          this.setState(newState);
        }}
      />
    );

    return (
      <GroupEventDataSection
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        <CrashContent
          group={group}
          event={evt}
          stackView={stackView}
          newestFirst={newestFirst}
          stacktrace={data} />
      </GroupEventDataSection>
    );
  }
});

export default StacktraceInterface;
