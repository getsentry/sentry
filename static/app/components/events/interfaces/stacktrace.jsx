import PropTypes from 'prop-types';
import React from 'react';
import ConfigStore from 'app/stores/configStore';
import GroupEventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import CrashHeader from 'app/components/events/interfaces/crashHeader';
import CrashContent from 'app/components/events/interfaces/crashContent';

export function isStacktraceNewestFirst() {
  const user = ConfigStore.get('user');
  // user may not be authenticated
  const options = user ? user.options : {};
  switch (options.stacktraceOrder) {
    case 2:
      return true;
    case 1:
      return false;
    case -1:
    default:
      return true;
  }
}

class StacktraceInterface extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      stackView: this.props.data.hasSystemFrames ? 'app' : 'full',
      newestFirst: isStacktraceNewestFirst(),
    };
  }

  toggleStack = value => {
    this.setState({
      stackView: value,
    });
  };

  render() {
    const group = this.props.group;
    const evt = this.props.event;
    const data = this.props.data;
    const stackView = this.state.stackView;
    const newestFirst = this.state.newestFirst;

    const title = (
      <CrashHeader
        title={t('Stacktrace')}
        group={group}
        platform={evt.platform}
        stacktrace={data}
        stackView={stackView}
        newestFirst={newestFirst}
        onChange={newState => {
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
        wrapTitle={false}
      >
        <CrashContent
          group={group}
          event={evt}
          stackView={stackView}
          newestFirst={newestFirst}
          stacktrace={data}
        />
      </GroupEventDataSection>
    );
  }
}

export default StacktraceInterface;
