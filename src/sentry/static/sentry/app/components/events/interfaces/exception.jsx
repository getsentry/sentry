import PropTypes from 'prop-types';
import React from 'react';
import {t} from '../../../locale';
import GroupEventDataSection from '../eventDataSection';
import SentryTypes from '../../../proptypes';
import {isStacktraceNewestFirst} from './stacktrace';
import CrashHeader from './crashHeader';
import CrashContent from './crashContent';

class ExceptionInterface extends React.Component {
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
      stackType: 'original',
    };
  }

  eventHasThreads = () => {
    return !!this.props.event.entries.find(x => x.type === 'threads');
  };

  render() {
    let group = this.props.group;
    let event = this.props.event;
    let data = this.props.data;
    let stackView = this.state.stackView;
    let stackType = this.state.stackType;
    let newestFirst = this.state.newestFirst;

    // in case there are threads in the event data, we don't render the
    // exception block.  Instead the exception is contained within the
    // thread interface.
    if (this.eventHasThreads()) {
      return null;
    }

    let title = (
      <CrashHeader
        group={group}
        title={t('Exception')}
        hasGuideAnchor={true}
        platform={event.platform}
        exception={data}
        stackView={stackView}
        newestFirst={newestFirst}
        stackType={stackType}
        onChange={newState => {
          this.setState(newState);
        }}
      />
    );

    return (
      <GroupEventDataSection
        group={group}
        event={event}
        type={this.props.type}
        title={title}
        wrapTitle={false}
      >
        <CrashContent
          group={group}
          event={event}
          stackType={stackType}
          stackView={stackView}
          newestFirst={newestFirst}
          exception={data}
        />
      </GroupEventDataSection>
    );
  }
}

export default ExceptionInterface;
